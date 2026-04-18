import IORedis, { type RedisOptions } from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import { logger } from '../../utils/logger.js';

/**
 * Shared Redis singleton. Used for caching, rate limiting, and BullMQ
 * queue plumbing.
 *
 * `REDIS_URL` is **optional** (see `apps/api/README.md` and the env
 * schema): when it is unset, rate limiting and the audio worker degrade
 * gracefully. We therefore must not throw at module import — doing so
 * crashes the entire server at boot because `ai.controller.ts` (and
 * anything else in the route graph) imports this module statically,
 * which in turn makes the Railway healthcheck on `/api/health` fail
 * with "service unavailable".
 */
const url = process.env.REDIS_URL;

// ioredis v5 ships as CommonJS. Using the default export is the
// canonical, spec-compliant import form and avoids NodeNext ESM/CJS
// interop ambiguity around named re-exports on the CJS exports object.
//
// TypeScript's NodeNext CJS interop types the default namespace without
// a call/construct signature, so we narrow it to the constructor type
// once at the boundary. The value received at runtime *is* the Redis
// class (ioredis's `module.exports = Redis`).
const RedisCtor = IORedis as unknown as new (
  url: string,
  options?: RedisOptions,
) => RedisType;

export const redis: RedisType | null = url
  ? new RedisCtor(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })
  : null;

if (redis) {
  redis.on('error', (err) => {
    logger.error({ err }, 'Redis connection error');
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });
} else {
  logger.warn('REDIS_URL not set — Redis-backed features will be skipped');
}

/**
 * Back-compat accessor: returns the shared `redis` instance, or `null`
 * when `REDIS_URL` is not configured. Callers that require Redis must
 * handle the `null` case explicitly (e.g. by falling back to an
 * in-memory path or a no-op).
 */
export function getRedis(): RedisType | null {
  return redis;
}

/**
 * Closes the Redis connection gracefully (no-op if Redis is disabled).
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}
