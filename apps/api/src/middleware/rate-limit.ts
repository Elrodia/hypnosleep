import type { Request, Response, NextFunction } from 'express';
import { rateLimitExceeded } from '../utils/errors.js';

/**
 * Simple in-memory sliding window rate limiter.
 * In production, this is backed by Redis for distributed rate limiting.
 * Falls back to in-memory when Redis is unavailable.
 */
const windowStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Strategy for building the rate-limit bucket key from a request.
 * Defaults to per-IP-per-route (so each route has its own budget);
 * callers that need a different scope (e.g. a true global per-IP
 * limiter, or a per-user limiter) can pass their own.
 */
export type RateLimitKeyFn = (req: Request) => string;

const defaultKeyFn: RateLimitKeyFn = (req) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  // Use the matched route pattern (e.g. `/sessions/:id`) rather than the
  // concrete request path so clients cannot bypass the limit by varying
  // dynamic path segments.
  const routePattern = req.route?.path ?? req.path;
  const route = `${req.baseUrl}${routePattern}`;
  return `ratelimit:${ip}:${route}`;
};

/**
 * Express middleware for rate limiting.
 * Uses a fixed-window approach, keyed by the supplied `keyFn`
 * (default: per-IP-per-route).
 *
 * @param windowSec - Window duration in seconds
 * @param maxRequests - Maximum requests allowed in the window
 * @param keyFn - Optional function to derive the bucket key from a request
 */
export function rateLimit(
  windowSec: number,
  maxRequests: number,
  keyFn: RateLimitKeyFn = defaultKeyFn,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyFn(req);
    const now = Date.now();

    try {
      // Try Redis-backed rate limiting first
      const { getRedis } = await import('../db/redis/client.js');
      const redis = getRedis();
      if (!redis) {
        // Fall through to the in-memory path below.
        throw new Error('redis-unavailable');
      }

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

// Periodically clean up expired in-memory entries. `.unref()` so the timer
// does not keep the Node event loop alive on its own — important for CLI
// tooling and test runners that import this module indirectly.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windowStore) {
    if (now >= entry.resetAt) {
      windowStore.delete(key);
    }
  }
}, 60000);
cleanupInterval.unref();

/**
 * Clears the in-memory rate limit store (for testing).
 */
export function _clearRateLimitStore(): void {
  windowStore.clear();
}

/**
 * Global IP-level rate limit applied at the top of the Express chain.
 * Unlike the default {@link rateLimit} keying (which is per-IP-per-route),
 * this keys purely by IP with a fixed `:global` suffix so that the budget
 * is shared across every route — callers can't bypass it by spraying
 * requests across different paths. Skips nothing itself — `server.ts` is
 * responsible for bypassing it on paths with their own rate-limiting
 * semantics (Stripe webhooks, SSE streams).
 */
const IP_LIMIT = 100; // requests
const IP_WINDOW_SEC = 60;

const globalIpKeyFn: RateLimitKeyFn = (req) => {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `ratelimit:${ip}:global`;
};

export const ipRateLimit = rateLimit(IP_WINDOW_SEC, IP_LIMIT, globalIpKeyFn);
