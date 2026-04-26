import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the multi-replica seed lock added in
 * `scripts/seed-templates.ts`. The seed script's main side effect is
 * to call Gemini for each pending template, so the lock is the
 * thing standing between "one Gemini call burst per deploy" and
 * "one burst per replica" — which previously caused the 429 storms
 * visible on the Gemini usage dashboard.
 *
 * The script's bottom-of-file `main()` invocation is gated on
 * `import.meta.url === argv[1]`, so importing the module from a test
 * does NOT kick off `main()` and we can exercise the lock helpers in
 * isolation.
 */

const setMock = vi.fn();
const getMock = vi.fn();
const evalMock = vi.fn();

let redisInstance: {
  set: typeof setMock;
  get: typeof getMock;
  eval: typeof evalMock;
} | null = {
  set: setMock,
  get: getMock,
  eval: evalMock,
};

vi.mock('@/db/redis/client', () => ({
  getRedis: () => redisInstance,
  redis: null,
  closeRedis: vi.fn(),
}));
// The script imports from `'../src/db/redis/client.js'` (relative,
// not via the `@/` alias), so vitest needs that exact specifier
// matched too. The factory returns the same dynamic `redisInstance`.
vi.mock('../../src/db/redis/client.js', () => ({
  getRedis: () => redisInstance,
  redis: null,
  closeRedis: vi.fn(),
}));

// `seed-templates.ts` statically imports `mysqlDb` (which validates
// the full env at module load), `generateScript`, and `generateAudio`.
// None of those are reachable from `acquireSeedLock` /
// `releaseSeedLock`, so mock them to plain stubs to keep the test
// hermetic.
vi.mock('../../src/db/mysql/client.js', () => ({
  mysqlDb: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));
vi.mock('../../src/modules/ai/ai.service.js', () => ({
  generateScript: vi.fn(),
}));
vi.mock('../../src/modules/audio/audio.service.js', () => ({
  generateAudio: vi.fn(),
}));

describe('seed-templates lock helpers', () => {
  beforeEach(() => {
    setMock.mockReset();
    getMock.mockReset();
    evalMock.mockReset();
    redisInstance = { set: setMock, get: getMock, eval: evalMock };
  });

  it('acquires the lock when SET NX EX returns OK', async () => {
    setMock.mockResolvedValueOnce('OK');
    const { acquireSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    const state = await acquireSeedLock();

    expect(state.kind).toBe('acquired');
    expect(setMock).toHaveBeenCalledWith(
      'seed-templates:lock',
      expect.any(String),
      'EX',
      15 * 60,
      'NX',
    );
  });

  it('reports busy and returns the existing holder when another replica owns it', async () => {
    setMock.mockResolvedValueOnce(null); // SET NX returns null when key exists
    getMock.mockResolvedValueOnce('replica-abc');

    const { acquireSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    const state = await acquireSeedLock();

    expect(state).toEqual({ kind: 'busy', holder: 'replica-abc' });
    // Callers MUST exit early on `busy` — the test asserts the
    // shape so the production main() never falls through to seeding.
  });

  it('falls back to "unavailable" (so seeding still runs) when Redis is not configured', async () => {
    redisInstance = null;
    const { acquireSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    const state = await acquireSeedLock();

    expect(state).toEqual({ kind: 'unavailable' });
    expect(setMock).not.toHaveBeenCalled();
  });

  it('falls back to "unavailable" when the SET call throws', async () => {
    setMock.mockRejectedValueOnce(new Error('redis down'));
    const { acquireSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    const state = await acquireSeedLock();

    expect(state.kind).toBe('unavailable');
  });

  it('release uses a compare-and-delete script so a stale token does not delete a re-acquired lock', async () => {
    evalMock.mockResolvedValueOnce(1);
    const { releaseSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    await releaseSeedLock('my-token');

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, token] = evalMock.mock.calls[0];
    expect(script).toContain('redis.call("get", KEYS[1])');
    expect(script).toContain('redis.call("del", KEYS[1])');
    expect(numKeys).toBe(1);
    expect(key).toBe('seed-templates:lock');
    expect(token).toBe('my-token');
  });

  it('release silently swallows Redis errors (best-effort cleanup)', async () => {
    evalMock.mockRejectedValueOnce(new Error('redis down'));
    const { releaseSeedLock } = await import(
      '../../scripts/seed-templates.ts'
    );

    await expect(releaseSeedLock('my-token')).resolves.toBeUndefined();
  });
});
