import IORedis, { type RedisOptions } from 'ioredis';
import type { Redis as RedisType } from 'ioredis';
import { logger } from '../../utils/logger.js';

/**
 * Eager Redis singleton. Used for caching, rate limiting, and BullMQ
 * queue plumbing. Throws at module load if `REDIS_URL` is unset so
 * misconfiguration is caught at boot rather than first request.
 */
const url = process.env.REDIS_URL;
if (!url) {
  throw new Error('REDIS_URL is not set');
}

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

export const redis = new RedisCtor(url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

/**
 * Back-compat accessor: returns the shared `redis` instance. Kept so
 * existing callers (queues, middleware) don't have to change imports.
 */
export function getRedis(): RedisType {
  return redis;
}

/**
 * Closes the Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}
