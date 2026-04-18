import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `@/db/redis/client` instantiates `ioredis` at module load when
 * `REDIS_URL` is set (and exports `null` otherwise). The helpers import
 * `{ redis }` from that module, so we mock the whole client module with
 * an in-memory fake that implements just the Redis surface the helpers
 * touch.
 */

type ZEntry = { member: string; score: number };

function createFakeRedis() {
  const strings = new Map<string, string>();
  const zsets = new Map<string, ZEntry[]>();
  const ttls = new Map<string, number>();

  const txOps: Array<() => unknown> = [];
  let inTx = false;

  const getZset = (key: string) => {
    let z = zsets.get(key);
    if (!z) {
      z = [];
      zsets.set(key, z);
    }
    return z;
  };

  const api: any = {
    // --- zset ops ---
    zremrangebyscore(key: string, min: number, max: number) {
      const op = () => {
        const z = getZset(key);
        const kept = z.filter((e) => e.score < min || e.score > max);
        zsets.set(key, kept);
        return z.length - kept.length;
      };
      if (inTx) {
        txOps.push(op);
        return api;
      }
      return Promise.resolve(op());
    },
    zcard(key: string) {
      const op = () => getZset(key).length;
      if (inTx) {
        txOps.push(op);
        return api;
      }
      return Promise.resolve(op());
    },
    zadd(key: string, score: number, member: string) {
      const op = () => {
        const z = getZset(key);
        z.push({ member, score });
        z.sort((a, b) => a.score - b.score);
        return 1;
      };
      if (inTx) {
        txOps.push(op);
        return api;
      }
      return Promise.resolve(op());
    },
    zrange(key: string, start: number, stop: number, opt?: 'WITHSCORES') {
      const op = () => {
        const z = getZset(key);
        const end = stop === -1 ? z.length - 1 : stop;
        const slice = z.slice(start, end + 1);
        if (opt === 'WITHSCORES') {
          const out: string[] = [];
          for (const e of slice) {
            out.push(e.member, String(e.score));
          }
          return out;
        }
        return slice.map((e) => e.member);
      };
      if (inTx) {
        txOps.push(op);
        return api;
      }
      return Promise.resolve(op());
    },
    expire(key: string, seconds: number) {
      const op = () => {
        ttls.set(key, seconds);
        return 1;
      };
      if (inTx) {
        txOps.push(op);
        return api;
      }
      return Promise.resolve(op());
    },

    // --- string ops ---
    async get(key: string) {
      return strings.has(key) ? (strings.get(key) as string) : null;
    },
    async set(key: string, value: string, _mode?: string, _ttl?: number) {
      strings.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]) {
      let n = 0;
      for (const k of keys) {
        if (strings.delete(k)) n++;
        if (zsets.delete(k)) n++;
      }
      return n;
    },
    async unlink(...keys: string[]) {
      return api.del(...keys);
    },

    // --- scan ---
    async scan(
      cursor: string,
      _match: 'MATCH',
      pattern: string,
      _count: 'COUNT',
      _n: number,
    ) {
      // Single-shot: return all matching keys then cursor '0'.
      if (cursor !== '0') return ['0', []];
      const re = new RegExp(
        '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      );
      const keys = [...strings.keys(), ...zsets.keys()].filter((k) => re.test(k));
      return ['0', keys];
    },

    // --- transactions ---
    multi() {
      inTx = true;
      txOps.length = 0;
      return api;
    },
    async exec() {
      const results = txOps.map((op) => [null, op()]);
      inTx = false;
      txOps.length = 0;
      return results;
    },

    // --- test-only helpers ---
    _peek: { strings, zsets, ttls },
  };

  return api;
}

const fakeRedis = createFakeRedis();

vi.mock('@/db/redis/client.js', () => ({
  redis: fakeRedis,
}));

// Re-import after the mock is registered.
const { checkRateLimit, cached, invalidateCache } = await import('@/db/redis/helpers');

describe('checkRateLimit', () => {
  beforeEach(() => {
    fakeRedis._peek.strings.clear();
    fakeRedis._peek.zsets.clear();
    fakeRedis._peek.ttls.clear();
  });

  it('allows requests under the limit and decrements remaining', async () => {
    const r1 = await checkRateLimit('user-1', 3, 60);
    const r2 = await checkRateLimit('user-1', 3, 60);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('rejects once the limit is reached', async () => {
    await checkRateLimit('user-2', 2, 60);
    await checkRateLimit('user-2', 2, 60);
    const r3 = await checkRateLimit('user-2', 2, 60);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('derives resetAt from the oldest entry in the window', async () => {
    const before = Date.now();
    await checkRateLimit('user-3', 5, 60);
    const res = await checkRateLimit('user-3', 5, 60);
    const after = Date.now();

    // oldest score is the first call's `now`, which lies in [before, after]
    expect(res.resetAt).toBeGreaterThanOrEqual(before + 60 * 1000);
    expect(res.resetAt).toBeLessThanOrEqual(after + 60 * 1000);
  });

  it('sets a TTL matching the window', async () => {
    await checkRateLimit('user-4', 1, 42);
    expect(fakeRedis._peek.ttls.get('ratelimit:user-4')).toBe(42);
  });
});

describe('cached', () => {
  beforeEach(() => {
    fakeRedis._peek.strings.clear();
    fakeRedis._peek.zsets.clear();
  });

  it('calls the loader on miss and caches the result', async () => {
    const loader = vi.fn().mockResolvedValue({ hello: 'world' });

    const v1 = await cached('k1', 60, loader);
    const v2 = await cached('k1', 60, loader);

    expect(v1).toEqual({ hello: 'world' });
    expect(v2).toEqual({ hello: 'world' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('recovers from a corrupt JSON entry by deleting it and calling loader', async () => {
    fakeRedis._peek.strings.set('bad', 'not-json{');
    const loader = vi.fn().mockResolvedValue(123);

    const value = await cached('bad', 60, loader);

    expect(value).toBe(123);
    expect(loader).toHaveBeenCalledTimes(1);
    // loader result should now be cached in place of the corrupt entry
    expect(fakeRedis._peek.strings.get('bad')).toBe('123');
  });
});

describe('invalidateCache', () => {
  beforeEach(() => {
    fakeRedis._peek.strings.clear();
  });

  it('deletes every key matching the pattern without using KEYS', async () => {
    fakeRedis._peek.strings.set('sessions:1', '{}');
    fakeRedis._peek.strings.set('sessions:2', '{}');
    fakeRedis._peek.strings.set('users:1', '{}');

    await invalidateCache('sessions:*');

    expect(fakeRedis._peek.strings.has('sessions:1')).toBe(false);
    expect(fakeRedis._peek.strings.has('sessions:2')).toBe(false);
    expect(fakeRedis._peek.strings.has('users:1')).toBe(true);
  });

  it('is a no-op when nothing matches', async () => {
    fakeRedis._peek.strings.set('users:1', '{}');
    await expect(invalidateCache('nope:*')).resolves.toBeUndefined();
    expect(fakeRedis._peek.strings.size).toBe(1);
  });
});
