import { eq, and, sql, desc, asc, like, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mysqlDb } from '../../db/mysql/client.js';
import { sessions } from '../../db/mysql/schema/sessions.js';
import { favorites } from '../../db/mysql/schema/favorites.js';
import { users } from '../../db/mysql/schema/users.js';
import { usageCounters } from '../../db/mysql/schema/usage-counters.js';
import { pgDb } from '../../db/postgres/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { getRedis } from '../../db/redis/client.js';
import { cached } from '../../db/redis/helpers.js';
import { enqueueAudioGeneration } from '../../queues/audio-generation.queue.js';
import {
  getStreamUrl,
  deleteFile,
  buildSessionKey,
} from '../audio/audio.s3.js';
import {
  AppError,
  notFound,
  forbidden,
  proRequired,
  rateLimitExceeded,
  validationFailed,
} from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import {
  RATE_LIMITS,
  VOICES,
  type VoiceId,
  type BackgroundSound,
  type SessionCategory,
} from '../../config/constants.js';
import type { Session as DbSession } from '../../db/mysql/schema/sessions.js';
import type {
  GenerateSessionInput,
  ListSessionsQuery,
  EditScriptInput,
  RegenerateInput,
} from './sessions.schema.js';

/**
 * Encodes the current UTC month as `YYYYMM` to key the per-month
 * usage counter row. Using UTC keeps the rollover deterministic
 * regardless of the host timezone.
 */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Best-effort fire-and-forget event log write. Analytics rows must
 * never block (or fail) a user-facing request — Postgres being
 * unavailable should degrade silently to "we lost an event".
 */
function logEvent(
  userId: string,
  sessionId: string | null,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  void pgDb
    .insert(events)
    .values({
      userId,
      sessionId,
      eventType,
      metadata: metadata ?? null,
    })
    .catch((err: unknown) => {
      logger.warn({ err, eventType, sessionId }, 'Failed to log analytics event');
    });
}

/**
 * Resolves a voice id against the registry. Throws a 400 if the id
 * is unknown and a 402 if the user is on the free plan but the voice
 * is gated behind Pro.
 */
function assertVoiceAccess(voiceId: string, isPro: boolean): void {
  const voice = (VOICES as Record<string, { label: string; pro: boolean }>)[voiceId];
  if (!voice) {
    throw validationFailed('Unknown voice id', { voiceId });
  }
  if (voice.pro && !isPro) {
    throw proRequired(`The voice "${voice.label}" is Pro only.`);
  }
}

/**
 * Creates a `generating`-state session row and enqueues an audio
 * generation job for it. Atomically enforces the free-tier monthly
 * quota using a MySQL upsert with a SQL-level increment so that two
 * concurrent generations cannot both squeak past the limit.
 *
 * Increments the usage counter only for free-plan users; Pro users
 * are unmetered.
 */
export async function createGenerationSession(
  userId: string,
  input: GenerateSessionInput,
): Promise<{ sessionId: string; status: 'generating' }> {
  const [user] = await mysqlDb
    .select({ id: users.id, plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  const isPro = user.plan === 'pro';

  // Voice access gating happens before any writes so a 402/400 leaves
  // no side effects behind.
  assertVoiceAccess(input.voiceId, isPro);

  if (!isPro) {
    const period = currentPeriod();
    const limit = RATE_LIMITS.AI_GENERATION_FREE;

    const [counter] = await mysqlDb
      .select()
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.userId, userId),
          eq(usageCounters.periodYyyymm, period),
        ),
      )
      .limit(1);

    const used = counter?.generationsCount ?? 0;
    if (used >= limit) {
      throw rateLimitExceeded(
        `Free tier limit of ${limit} generations/month reached. Upgrade to Pro for unlimited.`,
        { limit, used, upgradeUrl: '/upgrade' },
      );
    }

    // Atomic increment via upsert — concurrent inserts collapse to the
    // ON DUPLICATE branch which adds 1 in a single SQL statement.
    await mysqlDb
      .insert(usageCounters)
      .values({ userId, periodYyyymm: period, generationsCount: 1 })
      .onDuplicateKeyUpdate({
        set: {
          generationsCount: sql`${usageCounters.generationsCount} + 1`,
        },
      });
  }

  const sessionId = randomUUID();
  await mysqlDb.insert(sessions).values({
    id: sessionId,
    userId,
    title: 'Generating...',
    category: input.category as SessionCategory,
    durationSec: input.durationMin * 60,
    voiceId: input.voiceId,
    backgroundSound: input.background,
    status: 'generating',
    isTemplate: false,
  });

  await enqueueAudioGeneration({
    sessionId,
    userId,
    // Script is generated by the worker — pass the user prompt as a
    // placeholder script so existing job-data shape is preserved.
    scriptText: input.userPrompt,
    title: 'Generating...',
    voiceId: input.voiceId as VoiceId,
    backgroundSound: input.background as BackgroundSound,
    durationMinutes: input.durationMin,
    isPro,
  });

  logEvent(userId, sessionId, 'session_create', {
    category: input.category,
    durationMin: input.durationMin,
    voiceId: input.voiceId,
    inductionStyle: input.inductionStyle,
    depthLevel: input.depthLevel,
    wakeUpAtEnd: input.wakeUpAtEnd,
    background: input.background,
  });

  return { sessionId, status: 'generating' };
}

/** Result row shape returned from {@link listSessions}. */
export interface ListedSession {
  id: string;
  userId: string;
  title: string;
  category: DbSession['category'];
  durationSec: number;
  voiceId: string;
  backgroundSound: string | null;
  audioUrl: string | null;
  playCount: number;
  isTemplate: boolean;
  createdAt: Date;
  isFavorite: boolean;
}

/**
 * Lists sessions for the user's library with filters, sort, and
 * pagination.
 *
 * Scope rules:
 *   - Always restricted to `status='ready'` so half-built sessions
 *     never appear in the library UI.
 *   - When `includeTemplates` is true (the default), seed templates
 *     are merged in alongside the user's own sessions.
 *   - When `favoritesOnly` is true, the result is restricted via an
 *     INNER JOIN against `favorites`.
 *
 * The `isFavorite` boolean is computed in SQL with an `EXISTS`
 * subquery so we avoid an N+1 round-trip per row.
 */
export async function listSessions(
  userId: string,
  q: ListSessionsQuery,
): Promise<{
  items: ListedSession[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  const offset = (q.page - 1) * q.limit;

  const conditions = [eq(sessions.status, 'ready')];

  if (q.includeTemplates) {
    const visibility = or(
      eq(sessions.userId, userId),
      eq(sessions.isTemplate, true),
    );
    if (visibility) conditions.push(visibility);
  } else {
    conditions.push(eq(sessions.userId, userId));
  }

  if (q.category !== 'all') {
    conditions.push(eq(sessions.category, q.category as SessionCategory));
  }

  if (q.search) {
    conditions.push(like(sessions.title, `%${q.search}%`));
  }

  const sortColumn = {
    newest: desc(sessions.createdAt),
    oldest: asc(sessions.createdAt),
    most_played: desc(sessions.playCount),
    shortest: asc(sessions.durationSec),
    longest: desc(sessions.durationSec),
  }[q.sort];

  const isFavoriteExpr = sql<boolean>`EXISTS (
    SELECT 1 FROM ${favorites}
    WHERE ${favorites.userId} = ${userId}
      AND ${favorites.sessionId} = ${sessions.id}
  )`;

  const selectFields = {
    id: sessions.id,
    userId: sessions.userId,
    title: sessions.title,
    category: sessions.category,
    durationSec: sessions.durationSec,
    voiceId: sessions.voiceId,
    backgroundSound: sessions.backgroundSound,
    audioUrl: sessions.audioUrl,
    playCount: sessions.playCount,
    isTemplate: sessions.isTemplate,
    createdAt: sessions.createdAt,
    isFavorite: isFavoriteExpr,
  };

  const where = and(...conditions);

  // The favorites-only filter is expressed as an INNER JOIN so the
  // database can evaluate it in a single pass rather than running the
  // EXISTS subquery and then filtering.
  const rowsPromise = q.favoritesOnly
    ? mysqlDb
        .select(selectFields)
        .from(sessions)
        .innerJoin(
          favorites,
          and(
            eq(favorites.sessionId, sessions.id),
            eq(favorites.userId, userId),
          ),
        )
        .where(where)
        .orderBy(sortColumn)
        .limit(q.limit)
        .offset(offset)
    : mysqlDb
        .select(selectFields)
        .from(sessions)
        .where(where)
        .orderBy(sortColumn)
        .limit(q.limit)
        .offset(offset);

  const totalPromise = q.favoritesOnly
    ? mysqlDb
        .select({ total: sql<number>`COUNT(*)` })
        .from(sessions)
        .innerJoin(
          favorites,
          and(
            eq(favorites.sessionId, sessions.id),
            eq(favorites.userId, userId),
          ),
        )
        .where(where)
    : mysqlDb
        .select({ total: sql<number>`COUNT(*)` })
        .from(sessions)
        .where(where);

  const [rows, totalRows] = await Promise.all([rowsPromise, totalPromise]);
  const total = Number(totalRows[0]?.total ?? 0);

  const items = rows.map((r) => ({
    ...r,
    isFavorite: Boolean(r.isFavorite),
  })) as ListedSession[];

  return {
    items,
    meta: {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    },
  };
}

/**
 * Loads a single session by id. Templates are world-readable; private
 * sessions are visible only to their owner.
 *
 * Free-plan users that somehow look at a private session belonging to
 * someone else still get blocked by the ownership check above, so the
 * return shape always includes the full script for the owner. A
 * `scriptPreview` is also returned so non-owner UIs (e.g. template
 * cards) can show the first 200 characters without needing an extra
 * round-trip.
 */
export async function getSessionById(
  userId: string,
  sessionId: string,
): Promise<DbSession & { scriptPreview: string | null }> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) throw notFound('Session');

  if (row.userId !== userId && !row.isTemplate) {
    throw forbidden('You do not have access to this session');
  }

  return {
    ...row,
    scriptPreview: row.scriptText ? row.scriptText.slice(0, 200) : null,
  };
}

/**
 * Returns a presigned S3 URL for the session's final mixed audio.
 *
 * Refuses with 409 when the session has not finished generating yet,
 * because there is no object to sign. Access control mirrors
 * {@link getSessionById}: owner OR template.
 */
export async function getAudioUrl(
  userId: string,
  sessionId: string,
): Promise<string> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) throw notFound('Session');
  if (row.userId !== userId && !row.isTemplate) {
    throw forbidden('You do not have access to this session');
  }
  if (row.status !== 'ready') {
    throw new AppError('NOT_READY', 'Audio not ready yet', 409);
  }

  const key = buildSessionKey(row.userId, row.id);
  return getStreamUrl(key, 3600);
}

/**
 * Deletes a session row and best-effort removes its S3 object.
 *
 * Templates are immutable seed content and cannot be deleted by end
 * users. S3 deletion failures are logged but never propagated — the
 * DB row is still removed so the session disappears from the UI.
 */
export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<{ ok: true }> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) throw notFound('Session');
  if (row.userId !== userId) {
    throw forbidden('Cannot delete this session');
  }
  if (row.isTemplate) {
    throw forbidden('Cannot delete template sessions');
  }

  await deleteFile(buildSessionKey(userId, sessionId)).catch((err: unknown) => {
    logger.warn({ err, sessionId }, 'Failed to delete S3 audio file');
  });

  await mysqlDb.delete(sessions).where(eq(sessions.id, sessionId));
  return { ok: true };
}

/**
 * Toggles the favorite relationship between a user and a session.
 * Idempotent: calling twice in a row leaves the favorite count
 * unchanged.
 *
 * @returns `true` when the session is now favorited, `false` when
 *   it has just been unfavorited.
 */
export async function toggleFavorite(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const [existing] = await mysqlDb
    .select()
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.sessionId, sessionId)),
    )
    .limit(1);

  if (existing) {
    await mysqlDb
      .delete(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.sessionId, sessionId)),
      );
    return false;
  }

  // Verify the session exists before inserting — favorites has a FK to
  // sessions but we want a clean 404 rather than a generic FK error.
  const [exists] = await mysqlDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!exists) throw notFound('Session');

  await mysqlDb.insert(favorites).values({ userId, sessionId });
  logEvent(userId, sessionId, 'session_favorite');
  return true;
}

/**
 * Records that a user pressed play on a session: increments the
 * session's play count and writes a `session_play` analytics event.
 *
 * Also invalidates the trending cache because play counts are the
 * primary ranking signal for trending.
 */
export async function recordPlay(
  userId: string,
  sessionId: string,
): Promise<{ ok: true }> {
  const [exists] = await mysqlDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!exists) throw notFound('Session');

  await mysqlDb
    .update(sessions)
    .set({ playCount: sql`${sessions.playCount} + 1` })
    .where(eq(sessions.id, sessionId));

  logEvent(userId, sessionId, 'session_play');

  const redis = getRedis();
  if (redis) {
    await redis.del('cache:trending').catch((err: unknown) => {
      logger.warn({ err }, 'Failed to invalidate trending cache');
    });
  }

  return { ok: true };
}

/**
 * Replaces the script text of a Pro user's session. Free-plan users
 * are blocked at the controller layer with `requirePro()`, but we
 * also enforce ownership here so a Pro user cannot rewrite somebody
 * else's session.
 */
export async function editScript(
  userId: string,
  sessionId: string,
  input: EditScriptInput,
): Promise<{ ok: true }> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) throw notFound('Session');
  if (row.userId !== userId) {
    throw forbidden('Cannot edit this session');
  }
  if (row.isTemplate) {
    throw forbidden('Cannot edit template sessions');
  }

  await mysqlDb
    .update(sessions)
    .set({ scriptText: input.scriptText })
    .where(eq(sessions.id, sessionId));

  logEvent(userId, sessionId, 'session_script_edit');
  return { ok: true };
}

/**
 * Re-runs audio generation for an existing session, optionally with
 * a different voice and/or background. Reuses the stored
 * `scriptText` so the new audio matches what the user has already
 * reviewed and (if they are Pro) hand-edited.
 *
 * Flips the session back to `generating` so SSE clients can render
 * progress just like a fresh generation.
 */
export async function regenerateAudio(
  userId: string,
  sessionId: string,
  input: RegenerateInput,
  isPro: boolean,
): Promise<{ sessionId: string; status: 'generating' }> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) throw notFound('Session');
  if (row.userId !== userId) {
    throw forbidden('Cannot regenerate this session');
  }
  if (!row.scriptText) {
    throw new AppError(
      'NOT_READY',
      'Cannot regenerate audio before the script has been generated',
      409,
    );
  }

  const voiceId = input.voiceId ?? row.voiceId;
  const background = (input.background ?? row.backgroundSound ?? 'silence') as BackgroundSound;
  assertVoiceAccess(voiceId, isPro);

  await mysqlDb
    .update(sessions)
    .set({
      status: 'generating',
      voiceId,
      backgroundSound: background,
    })
    .where(eq(sessions.id, sessionId));

  await enqueueAudioGeneration({
    sessionId,
    userId,
    scriptText: row.scriptText,
    title: row.title,
    voiceId: voiceId as VoiceId,
    backgroundSound: background,
    durationMinutes: Math.max(1, Math.round(row.durationSec / 60)),
    isPro,
  });

  logEvent(userId, sessionId, 'session_regenerate', { voiceId, background });

  return { sessionId, status: 'generating' };
}

/** Number of trending sessions returned to clients. */
const TRENDING_LIMIT = 10;
/** Trending cache TTL in seconds (1 hour). */
const TRENDING_TTL_SEC = 3600;

/**
 * Returns the most-played template sessions, cached in Redis for
 * one hour. Custom user sessions are excluded from trending in MVP;
 * only seed templates are surfaced to the community.
 */
export async function getTrending(): Promise<DbSession[]> {
  return cached<DbSession[]>('cache:trending', TRENDING_TTL_SEC, async () => {
    return mysqlDb
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.isTemplate, true), eq(sessions.status, 'ready')),
      )
      .orderBy(desc(sessions.playCount))
      .limit(TRENDING_LIMIT);
  });
}
