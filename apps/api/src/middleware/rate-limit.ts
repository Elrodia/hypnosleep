import type { Request, Response, NextFunction } from 'express';
import { rateLimitExceeded } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Simple in-memory sliding window rate limiter.
 * In production, this is backed by Redis for distributed rate limiting.
 * Falls back to in-memory when Redis is unavailable.
 */
const windowStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Express middleware for rate limiting.
 * Uses a fixed-window approach per IP address.
 *
 * @param windowSec - Window duration in seconds
 * @param maxRequests - Maximum requests allowed in the window
 */
export function rateLimit(windowSec: number, maxRequests: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const route = req.baseUrl + req.path;
    const key = `ratelimit:${ip}:${route}`;
    const now = Date.now();

    try {
      // Try Redis-backed rate limiting first
      const { getRedis } = await import('../db/redis/client.js');
      const redis = getRedis();

      const redisKey = key;
      const current = await redis.incr(redisKey);

      if (current === 1) {
        await redis.expire(redisKey, windowSec);
      }

      if (current > maxRequests) {
        const ttl = await redis.ttl(redisKey);
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : windowSec));
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');

        next(
          rateLimitExceeded('Too many requests, please try again later', {
            limit: maxRequests,
            windowSec,
            retryAfter: ttl > 0 ? ttl : windowSec,
          }),
        );
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - current));
      next();
    } catch {
      // Fall back to in-memory rate limiting
      const entry = windowStore.get(key);

      if (!entry || now >= entry.resetAt) {
        windowStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
        next();
        return;
      }

      entry.count += 1;

      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        res.setHeader('X-RateLimit-Limit', String(maxRequests));
        res.setHeader('X-RateLimit-Remaining', '0');

        next(
          rateLimitExceeded('Too many requests, please try again later', {
            limit: maxRequests,
            windowSec,
            retryAfter,
          }),
        );
        return;
      }

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - entry.count));
      next();
    }
  };
}

// Periodically clean up expired in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windowStore) {
    if (now >= entry.resetAt) {
      windowStore.delete(key);
    }
  }
}, 60000);

/**
 * Clears the in-memory rate limit store (for testing).
 */
export function _clearRateLimitStore(): void {
  windowStore.clear();
}
