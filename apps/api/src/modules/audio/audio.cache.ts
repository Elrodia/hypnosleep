import { getRedis } from '../../db/redis/client.js';
import { logger } from '../../utils/logger.js';

/**
 * Cache TTL for presigned stream URLs, in seconds.
 *
 * Set to slightly less than the shortest presigned URL lifetime
 * (free-plan URLs expire after 3600s) so a cached URL handed to a
 * client always has a non-zero remaining validity window.
 */
const STREAM_URL_TTL = 3300; // 55 minutes

type Plan = 'free' | 'pro';

/**
 * Cached presigned URL together with the absolute moment at which the
 * underlying signature stops working. We persist the actual signing
 * expiry (not "now + plan TTL") so cache hits don't overstate the
 * URL's remaining validity by up to ~55 minutes.
 */
export interface CachedStreamUrl {
  url: string;
  /** ISO-8601 timestamp at which the presigned URL stops working. */
  expiresAt: string;
}

function key(plan: Plan, sessionId: string): string {
  return `audio:url:${plan}:${sessionId}`;
}

/**
 * Returns a previously cached presigned stream URL (with its real
 * signing expiry) for the given `(sessionId, plan)` pair, or `null`
 * on miss / when Redis is not configured / on corrupted JSON.
 *
 * Plan is part of the cache key because Pro and Free users get URLs
 * with different TTLs (24h vs 1h) — they cannot share a cache entry.
 */
export async function getCachedStreamUrl(
  sessionId: string,
  plan: Plan,
): Promise<CachedStreamUrl | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key(plan, sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedStreamUrl>;
    if (!parsed.url || !parsed.expiresAt) {
      // Treat unparseable / legacy entries as a miss; let the caller
      // re-sign and overwrite.
      await redis.del(key(plan, sessionId)).catch(() => {});
      return null;
    }
    return { url: parsed.url, expiresAt: parsed.expiresAt };
  } catch (err) {
    logger.warn({ err, sessionId, plan }, 'Failed to read cached stream URL');
    return null;
  }
}

/**
 * Stores a freshly minted presigned URL together with its absolute
 * `expiresAt` for `STREAM_URL_TTL` seconds.
 *
 * Best-effort: on Redis errors we log and continue so the request that
 * generated the URL still succeeds.
 */
export async function setCachedStreamUrl(
  sessionId: string,
  plan: Plan,
  url: string,
  expiresAt: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(
      key(plan, sessionId),
      JSON.stringify({ url, expiresAt }),
      'EX',
      STREAM_URL_TTL,
    );
  } catch (err) {
    logger.warn({ err, sessionId, plan }, 'Failed to cache stream URL');
  }
}

/**
 * Drops both plan variants of the cached stream URL for a session.
 * Call after session deletion or audio regeneration so subsequent
 * `GET /sessions/:id/audio` requests re-sign against the new object.
 */
export async function invalidateAudioCache(sessionId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key('free', sessionId), key('pro', sessionId));
  } catch (err) {
    logger.warn({ err, sessionId }, 'Failed to invalidate audio URL cache');
  }
}

/** Exposed for tests so they can assert the TTL contract. */
export const _STREAM_URL_TTL_SEC = STREAM_URL_TTL;
