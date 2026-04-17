import { redis } from './client.js';

/**
 * Sliding window rate limiter using Redis sorted sets.
 *
 * A per-key ZSET stores request timestamps; before each check we evict
 * entries older than `windowSec`, then count what's left.
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

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zcard(redisKey);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.expire(redisKey, windowSec);

  const results = await pipeline.exec();
  const count = (results?.[1]?.[1] as number) ?? 0;

  return {
    allowed: count < limit,
    remaining: Math.max(0, limit - count - 1),
    resetAt: now + windowSec * 1000,
  };
}

/**
 * Generic read-through JSON cache. On miss, invokes `loader`, stores the
 * result under `key` with a `ttlSec` TTL, and returns it.
 */
export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;
  const fresh = await loader();
  await redis.set(key, JSON.stringify(fresh), 'EX', ttlSec);
  return fresh;
}

/**
 * Deletes every key matching `pattern`. Intended for small cache
 * namespaces; `KEYS` is O(N) so callers should scope patterns narrowly.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
