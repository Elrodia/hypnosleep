import { Redis } from 'ioredis';
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

export const redis = new Redis(url, {
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
export function getRedis(): Redis {
  return redis;
}

/**
 * Closes the Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  await redis.quit();
}
