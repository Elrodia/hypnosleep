import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the Gemini provider-level quota guard (`ai.gemini.guard.ts`).
 *
 * We follow the same mocking pattern as `tests/db/redis/helpers.test.ts`:
 * the `@/db/redis/client` module is replaced with an in-memory fake that
 * implements just the Redis surface touched by `checkRateLimit` (sorted-set
 * ops + MULTI/EXEC transactions). This lets us exercise the guard without
 * a real Redis instance or real Gemini API keys.
 */

// ── Fake Redis ────────────────────────────────────────────────────────────────

type ZEntry = { member: string; score: number };

function createFakeRedis() {
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
    zremrangebyscore(key: string, min: number, max: number) {
      const op = () => {
        const z = getZset(key);
        const kept = z.filter((e) => e.score < min || e.score > max);
        zsets.set(key, kept);
        return z.length - kept.length;
      };
      if (inTx) { txOps.push(op); return api; }
      return Promise.resolve(op());
    },
    zcard(key: string) {
      const op = () => getZset(key).length;
      if (inTx) { txOps.push(op); return api; }
      return Promise.resolve(op());
    },
    zadd(key: string, score: number, member: string) {
      const op = () => {
        const z = getZset(key);
        z.push({ member, score });
        z.sort((a, b) => a.score - b.score);
        return 1;
      };
      if (inTx) { txOps.push(op); return api; }
      return Promise.resolve(op());
    },
    zrange(key: string, start: number, stop: number, opt?: 'WITHSCORES') {
      const op = () => {
        const z = getZset(key);
        const end = stop === -1 ? z.length - 1 : stop;
        const slice = z.slice(start, end + 1);
        if (opt === 'WITHSCORES') {
          const out: string[] = [];
          for (const e of slice) out.push(e.member, String(e.score));
          return out;
        }
        return slice.map((e) => e.member);
      };
      if (inTx) { txOps.push(op); return api; }
      return Promise.resolve(op());
    },
    expire(key: string, seconds: number) {
      const op = () => { ttls.set(key, seconds); return 1; };
      if (inTx) { txOps.push(op); return api; }
      return Promise.resolve(op());
    },
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
    _peek: { zsets, ttls },
  };

  return api;
}

const fakeRedis = createFakeRedis();

vi.mock('@/db/redis/client.js', () => ({
  redis: fakeRedis,
}));

// Re-import after the mock is registered so the modules see fakeRedis.
const { checkGeminiQuota } = await import('@/modules/ai/ai.gemini.guard');
const { callGemini, _setModel } = await import('@/modules/ai/ai.gemini');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Clears all rate-limit state between tests. */
function clearRedisState() {
  fakeRedis._peek.zsets.clear();
  fakeRedis._peek.ttls.clear();
}

/** Exhausts the per-minute bucket by calling `checkGeminiQuota` `n` times. */
async function exhaustMinute(n: number) {
  for (let i = 0; i < n; i++) {
    await checkGeminiQuota();
  }
}

/** Exhausts the per-day bucket by calling `checkGeminiQuota` `n` times. */
async function exhaustDay(n: number) {
  for (let i = 0; i < n; i++) {
    await checkGeminiQuota();
  }
}

// ── Tests — checkGeminiQuota ─────────────────────────────────────────────────

describe('checkGeminiQuota — minute limit', () => {
  beforeEach(() => {
    clearRedisState();
    process.env.GEMINI_RATE_LIMIT_PER_MINUTE = '3';
    process.env.GEMINI_RATE_LIMIT_PER_DAY = '1000';
  });

  afterEach(() => {
    delete process.env.GEMINI_RATE_LIMIT_PER_MINUTE;
    delete process.env.GEMINI_RATE_LIMIT_PER_DAY;
  });

  it('allows calls that are below the per-minute limit', async () => {
    await expect(checkGeminiQuota()).resolves.toBeUndefined();
    await expect(checkGeminiQuota()).resolves.toBeUndefined();
  });

  it('rejects the call that exceeds the per-minute limit', async () => {
    // Use up all 3 slots.
    await exhaustMinute(3);

    await expect(checkGeminiQuota()).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: expect.objectContaining({
        limit: 3,
        windowSec: 60,
        retryAfter: expect.any(Number),
      }),
    });
  });

  it('rejection message mentions per-minute limit', async () => {
    await exhaustMinute(3);

    await expect(checkGeminiQuota()).rejects.toThrow(/per-minute quota exceeded/i);
  });

  it('retryAfter is a positive integer (seconds)', async () => {
    await exhaustMinute(3);

    try {
      await checkGeminiQuota();
      expect.fail('expected a rate-limit error');
    } catch (err: any) {
      expect(err.details.retryAfter).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(err.details.retryAfter)).toBe(true);
    }
  });
});

describe('checkGeminiQuota — daily limit', () => {
  beforeEach(() => {
    clearRedisState();
    // Set day limit low so we don't need thousands of calls.
    process.env.GEMINI_RATE_LIMIT_PER_MINUTE = '1000';
    process.env.GEMINI_RATE_LIMIT_PER_DAY = '2';
  });

  afterEach(() => {
    delete process.env.GEMINI_RATE_LIMIT_PER_MINUTE;
    delete process.env.GEMINI_RATE_LIMIT_PER_DAY;
  });

  it('allows calls below the daily limit', async () => {
    await expect(checkGeminiQuota()).resolves.toBeUndefined();
  });

  it('rejects the call that exceeds the daily limit', async () => {
    // Use up both day slots.
    await exhaustDay(2);

    await expect(checkGeminiQuota()).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: expect.objectContaining({
        limit: 2,
        windowSec: 86400,
        retryAfter: expect.any(Number),
      }),
    });
  });

  it('rejection message mentions daily limit', async () => {
    await exhaustDay(2);

    await expect(checkGeminiQuota()).rejects.toThrow(/daily quota exceeded/i);
  });
});

describe('checkGeminiQuota — env var defaults', () => {
  beforeEach(() => {
    clearRedisState();
    delete process.env.GEMINI_RATE_LIMIT_PER_MINUTE;
    delete process.env.GEMINI_RATE_LIMIT_PER_DAY;
  });

  it('uses 15 as the default per-minute limit', async () => {
    // 15 calls should succeed, the 16th should fail.
    for (let i = 0; i < 15; i++) {
      await expect(checkGeminiQuota()).resolves.toBeUndefined();
    }
    await expect(checkGeminiQuota()).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      details: expect.objectContaining({ limit: 15, windowSec: 60 }),
    });
  });
});

// ── Tests — callGemini quota guard integration ────────────────────────────────

describe('callGemini — quota guard integration', () => {
  function createMockModel(text = 'mock response') {
    return {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => text,
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
        },
      }),
    };
  }

  beforeEach(() => {
    clearRedisState();
    process.env.GEMINI_RATE_LIMIT_PER_MINUTE = '2';
    process.env.GEMINI_RATE_LIMIT_PER_DAY = '1000';
    process.env.GEMINI_API_KEY = 'test-key';
  });

  afterEach(() => {
    _setModel(null);
    delete process.env.GEMINI_RATE_LIMIT_PER_MINUTE;
    delete process.env.GEMINI_RATE_LIMIT_PER_DAY;
    delete process.env.GEMINI_API_KEY;
  });

  it('allows callGemini when quota is not yet exhausted', async () => {
    const mock = createMockModel('Hello from Gemini');
    _setModel(mock as any);

    const result = await callGemini('test prompt');

    expect(result.text).toBe('Hello from Gemini');
    expect(mock.generateContent).toHaveBeenCalledOnce();
  });

  it('blocks callGemini when the per-minute quota is exhausted', async () => {
    const mock = createMockModel('response');
    _setModel(mock as any);

    // Use up both minute slots.
    await callGemini('prompt 1');
    await callGemini('prompt 2');

    // Third call should be rejected by the guard before reaching Gemini.
    await expect(callGemini('prompt 3')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
    });

    // Gemini was NOT called a third time — the guard fired first.
    expect(mock.generateContent).toHaveBeenCalledTimes(2);
  });

  it('blocks callGemini when the daily quota is exhausted', async () => {
    process.env.GEMINI_RATE_LIMIT_PER_MINUTE = '1000';
    process.env.GEMINI_RATE_LIMIT_PER_DAY = '1';

    const mock = createMockModel('response');
    _setModel(mock as any);

    // Use up the single day slot.
    await callGemini('prompt 1');

    // Second call should be rejected by the day guard.
    await expect(callGemini('prompt 2')).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      details: expect.objectContaining({ windowSec: 86400 }),
    });

    expect(mock.generateContent).toHaveBeenCalledTimes(1);
  });
});
