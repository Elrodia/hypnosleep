import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getRedis } from '../../db/redis/client.js';
import { logger } from '../../utils/logger.js';
import { unauthenticated, validationFailed, AppError } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * Per-user, Redis-backed notifications inbox.
 *
 * Storage model
 * -------------
 * One Redis hash per user at `notif:u:{userId}` mapping notification
 * id → JSON-serialized {@link AppNotification}. We additionally keep
 * a sorted-set index `notif:idx:u:{userId}` keyed on the unix-ms
 * `createdAt` so listing returns newest-first in O(log N) without
 * loading every notification value.
 *
 * Why Redis (not Postgres)?
 * - Notifications here are ephemeral UI signals (session ready,
 *   reminder fired, weekly insight available). They are not source
 *   of truth — the underlying data already lives in Postgres/MySQL.
 * - The cap below (`MAX_PER_USER`) prevents unbounded growth.
 * - A future migration to Postgres is mechanical: swap the storage
 *   functions, keep the same controller surface.
 */

/** Maximum notifications retained per user — older entries are pruned. */
const MAX_PER_USER = 50;

interface AppNotification {
  id: string;
  type: 'session_ready' | 'reminder' | 'weekly_insight' | 'system';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  url?: string | null;
}

function hashKey(userId: string): string {
  return `notif:u:${userId}`;
}

function indexKey(userId: string): string {
  return `notif:idx:u:${userId}`;
}

function storageUnavailable(): AppError {
  return new AppError('STORAGE_UNAVAILABLE', 'Notifications storage is not available', 503);
}

/**
 * Internal: enqueue a notification for a user. Safe to call from
 * other modules (e.g. the audio worker on session_ready) — failures
 * are logged but never thrown so a notification miss never blocks
 * the underlying business operation.
 */
export async function enqueueNotification(
  userId: string,
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'> & { url?: string | null },
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const notif: AppNotification = {
    id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    createdAt,
    readAt: null,
    url: payload.url ?? null,
  };
  try {
    await redis.hset(hashKey(userId), id, JSON.stringify(notif));
    await redis.zadd(indexKey(userId), Date.now(), id);
    // Trim oldest entries past MAX_PER_USER.
    const total = await redis.zcard(indexKey(userId));
    if (total > MAX_PER_USER) {
      const drop = total - MAX_PER_USER;
      const oldestIds = await redis.zrange(indexKey(userId), 0, drop - 1);
      if (oldestIds.length > 0) {
        await redis.zrem(indexKey(userId), ...oldestIds);
        await redis.hdel(hashKey(userId), ...oldestIds);
      }
    }
  } catch (err) {
    logger.warn({ err, userId, type: payload.type }, 'Failed to enqueue notification');
  }
}

function requireUserId(req: Request): string {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) throw unauthenticated();
  return user.userId;
}

/** GET /api/notifications */
export async function handleList(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const redis = getRedis();
  if (!redis) throw storageUnavailable();

  // Newest-first: zrevrange returns ids by descending createdAt score.
  const ids = await redis.zrevrange(indexKey(userId), 0, MAX_PER_USER - 1);
  if (ids.length === 0) {
    res.json({ data: [] });
    return;
  }
  const raw = await redis.hmget(hashKey(userId), ...ids);
  const items: AppNotification[] = [];
  for (const blob of raw) {
    if (!blob) continue;
    try {
      items.push(JSON.parse(blob) as AppNotification);
    } catch (err) {
      logger.warn({ err, userId }, 'Corrupted notification payload — skipping');
    }
  }
  res.json({ data: items });
}

/** POST /api/notifications/:id/read */
export async function handleMarkRead(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const id = String(req.params.id ?? '');
  if (!/^[A-Za-z0-9-]{1,128}$/.test(id)) {
    throw validationFailed('Invalid notification id');
  }
  const redis = getRedis();
  if (!redis) throw storageUnavailable();

  const blob = await redis.hget(hashKey(userId), id);
  if (!blob) {
    res.json({ data: { ok: true } });
    return;
  }
  try {
    const notif = JSON.parse(blob) as AppNotification;
    notif.readAt = new Date().toISOString();
    await redis.hset(hashKey(userId), id, JSON.stringify(notif));
  } catch (err) {
    logger.warn({ err, userId, id }, 'Could not mark notification read');
  }
  res.json({ data: { ok: true } });
}

/** POST /api/notifications/read-all */
export async function handleMarkAllRead(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const redis = getRedis();
  if (!redis) throw storageUnavailable();

  const ids = await redis.zrange(indexKey(userId), 0, -1);
  if (ids.length === 0) {
    res.json({ data: { ok: true } });
    return;
  }
  const raw = await redis.hmget(hashKey(userId), ...ids);
  const now = new Date().toISOString();
  const writes: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 1) {
    const blob = raw[i];
    if (!blob) continue;
    try {
      const notif = JSON.parse(blob) as AppNotification;
      if (notif.readAt) continue;
      notif.readAt = now;
      writes[ids[i]] = JSON.stringify(notif);
    } catch {
      /* skip corrupted */
    }
  }
  if (Object.keys(writes).length > 0) {
    await redis.hset(hashKey(userId), writes);
  }
  res.json({ data: { ok: true } });
}
