import type { Request, Response } from 'express';
import type { JwtPayload } from '../../middleware/authenticate.js';
import { getRedis } from '../../db/redis/client.js';
import { logger } from '../../utils/logger.js';
import { AppError, unauthenticated, validationFailed } from '../../utils/errors.js';

/**
 * 503 — storage backend (Redis) is not available. Returned so the
 * client-side `useKV` hook can gracefully fall back to in-memory state
 * instead of looping on 5xxs.
 */
function storageUnavailable(): AppError {
  return new AppError(
    'STORAGE_UNAVAILABLE',
    'Persistent storage is not available',
    503,
  );
}

/**
 * Per-user, Redis-backed key/value store used by the frontend's
 * `useKV` hook to persist UI state (preferences, onboarding flags,
 * cached stats, etc.) across devices and reloads.
 *
 * Scope & isolation
 * -----------------
 * Every key is stored under `kv:u:{userId}:{key}`. There is no way
 * for one authenticated user to reach another user's data because
 * the Express handler derives `userId` from the verified JWT — it
 * never trusts a client-supplied identifier.
 *
 * Accepted keys
 * -------------
 * Keys are restricted to `[a-z0-9][a-z0-9-]{0,62}` so they are safe
 * to interpolate into the Redis key template without escaping and
 * so unbounded garbage can't be stashed in Redis by a malicious
 * client. Uppercase, whitespace, `:`, and `/` are rejected.
 *
 * Value shape & size
 * ------------------
 * Values are arbitrary JSON, stored as UTF-8 encoded strings. The
 * serialized form is capped at 64 KiB per key so a single user
 * can't fill Redis with giant blobs.
 */

/** Maximum serialized value size per key. */
const MAX_VALUE_BYTES = 64 * 1024;

/** Per-key validation. Anchored, lowercase, bounded length. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

function storageKey(userId: string, key: string): string {
  return `kv:u:${userId}:${key}`;
}

function validateKey(raw: unknown): string {
  if (typeof raw !== 'string' || !KEY_PATTERN.test(raw)) {
    throw validationFailed(
      'Invalid key: must match /^[a-z0-9][a-z0-9-]{0,62}$/',
    );
  }
  return raw;
}

/**
 * `GET /api/kv/:key` — read a single value for the authenticated user.
 *
 * Response shape is `{ data: { value: unknown | null } }`. A `null`
 * `value` means the key has never been written (the frontend hook
 * falls back to its `initialValue` in that case) — this is
 * intentionally distinct from a parse failure, which still returns
 * `null` so a corrupted value can't wedge the client but is logged
 * for operators.
 */
export async function handleGetKv(req: Request, res: Response): Promise<void> {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    throw unauthenticated();
  }
  const userId = user.userId;

  const key = validateKey(req.params.key);
  const redis = getRedis();
  if (!redis) {
    throw storageUnavailable();
  }

  const raw = await redis.get(storageKey(userId, key));
  if (raw === null) {
    res.json({ data: { value: null } });
    return;
  }

  try {
    const value: unknown = JSON.parse(raw);
    res.json({ data: { value } });
  } catch (err) {
    logger.warn({ err, userId, key }, 'Corrupted KV value — returning null');
    res.json({ data: { value: null } });
  }
}

/**
 * `PUT /api/kv/:key` — write a single value for the authenticated user.
 *
 * Request body: `{ value: unknown }`. The `value` is serialized to
 * JSON (so arbitrary shapes are supported) and the serialized blob
 * is capped at {@link MAX_VALUE_BYTES}. Setting `value` to `null`
 * removes the key, matching the `useKV` delete semantics.
 */
export async function handlePutKv(req: Request, res: Response): Promise<void> {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    throw unauthenticated();
  }
  const userId = user.userId;

  const key = validateKey(req.params.key);
  const body = req.body as { value?: unknown } | undefined;
  if (!body || !('value' in body)) {
    throw validationFailed('Request body must be `{ "value": <json> }`');
  }

  const redis = getRedis();
  if (!redis) {
    throw storageUnavailable();
  }

  const rKey = storageKey(userId, key);

  if (body.value === null) {
    await redis.del(rKey);
    res.json({ data: { ok: true } });
    return;
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(body.value);
  } catch {
    throw validationFailed('Value is not JSON-serializable');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_VALUE_BYTES) {
    throw validationFailed(
      `Value too large (max ${MAX_VALUE_BYTES} bytes when JSON-encoded)`,
    );
  }

  await redis.set(rKey, serialized);
  res.json({ data: { ok: true } });
}

/** `DELETE /api/kv/:key` — remove a single value for the authenticated user. */
export async function handleDeleteKv(
  req: Request,
  res: Response,
): Promise<void> {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    throw unauthenticated();
  }
  const userId = user.userId;

  const key = validateKey(req.params.key);
  const redis = getRedis();
  if (!redis) {
    throw storageUnavailable();
  }

  await redis.del(storageKey(userId, key));
  res.json({ data: { ok: true } });
}
