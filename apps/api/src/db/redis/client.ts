import Redis from 'ioredis';
import { logger } from '../../utils/logger.js';

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client.
 * Lazily creates the connection on first call.
 */
export function getRedis(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('REDIS_URL is not set');
    }

    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error');
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  return redisClient;
}

/**
 * Closes the Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
