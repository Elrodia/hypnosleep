import { redis } from './client.js';

/**
 * Sliding window rate limiter using Redis sorted sets.
 *
 * A per-key ZSET stores request timestamps. Eviction of stale entries,
 * counting, insertion of the new entry, and TTL refresh all happen inside
 * a single `MULTI`/`EXEC` transaction so concurrent callers can't
 * interleave reads and writes and burst past `limit`.
 *
 * `resetAt` is derived from the oldest retained timestamp in the window
 * (so callers learn when the next slot actually frees up), falling back
 * to `now + windowSec*1000` only when the set is empty.
 *
 * @returns `allowed` false once `limit` is exceeded in the window.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const redisKey = `ratelimit:${key}`;

  const tx = redis.multi();
  tx.zremrangebyscore(redisKey, 0, windowStart);
  tx.zcard(redisKey);
  tx.zadd(redisKey, now, `${now}-${Math.random()}`);
  tx.expire(redisKey, windowSec);
  tx.zrange(redisKey, 0, 0, 'WITHSCORES');

  const results = await tx.exec();
  const count = (results?.[1]?.[1] as number) ?? 0;
  const oldestEntry = results?.[4]?.[1] as string[] | undefined;
  const oldestScore =
    oldestEntry && oldestEntry[1] != null ? Number(oldestEntry[1]) : now;

  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count - 1),
    resetAt: oldestScore + windowSec * 1000,
  };
}

/**
 * Generic read-through JSON cache. On miss, invokes `loader`, stores the
 * result under `key` with a `ttlSec` TTL, and returns it.
 *
 * If the cached value is corrupt / not valid JSON (e.g. written by a
 * previous schema or an unrelated tool), the bad entry is deleted and
 * `loader` is invoked as if it were a cache miss — this prevents one bad
 * key from taking down every request on the hot path.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      await redis.del(key);
    }
  }
  const fresh = await loader();
  await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec);
  return fresh;
}

/**
 * Deletes every key matching `pattern` by scanning in batches, to avoid
 * blocking Redis with a single `KEYS` call. Uses `UNLINK` so the actual
 * memory reclaim happens asynchronously on the Redis side.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  let cursor = '0';

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100,
    );

    if (keys.length > 0) await redis.unlink(...keys);
    cursor = nextCursor;
  } while (cursor !== '0');
}
