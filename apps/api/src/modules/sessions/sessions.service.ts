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
import { progressMirrorKey } from '../../queues/events.bus.js';
import { generateScript } from '../ai/ai.service.js';
import {
  getStreamUrl,
  deleteFile,
  buildSessionKey,
} from '../audio/audio.s3.js';
import {
  getCachedStreamUrl,
  setCachedStreamUrl,
  invalidateAudioCache,
} from '../audio/audio.cache.js';
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
  VOICES,
  PLAN_LIMITS,
  type VoiceId,
  type BackgroundSound,
  type SessionCategory,
  type PlanKey,
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

/** ISO 8601 timestamp for 00:00 UTC on the 1st of next calendar month. */
function nextMonthResetIso(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const next = new Date(Date.UTC(month === 11 ? year + 1 : year, (month + 1) % 12, 1, 0, 0, 0, 0));
  return next.toISOString();
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
 * Creates a `generating`-state session row and enqueues an audio
 * generation job for it.
 *
 * The script text itself is generated *synchronously* via Gemini here
 * (before we respond) so the MySQL row always carries a real
 * `title` + `scriptText` by the time the frontend subscribes to SSE.
 * The audio worker then handles chunked TTS + mix + upload.
 *
 * Plan-aware gating runs BEFORE any DB writes:
 *   1. Duration must lie in `[minDurationMin, maxDurationMin]`.
 *   2. Voice must be in `voicesAllowed` (or 'all').
 *   3. Background must be in `backgroundsAllowed` (or 'all').
 *   4. Free users are capped at `sessionsLifetime` total generations.
 *   5. Pro users are capped at `sessionsPerMonth` per UTC month with
 *      the same atomic post-increment + roll-back pattern previously
 *      used for free users.
 *
 * Free-tier lifetime is incremented atomically just BEFORE inserting
 * the session row so two concurrent requests can't both slip past the
 * check. Any later failure rolls the per-period pro counter back so
 * a failed request doesn't consume quota.
 */
export async function createGenerationSession(
  userId: string,
  input: GenerateSessionInput,
): Promise<{ sessionId: string; status: 'generating' }> {
  const [user] = await mysqlDb
    .select({
      id: users.id,
      plan: users.plan,
      sessionsLifetime: users.sessionsLifetime,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  const plan = user.plan as PlanKey;
  const limits = PLAN_LIMITS[plan];
  const isPro = plan === 'pro';

  // ── 1. Duration cap ──────────────────────────────────────────────
  if (
    input.durationMin < limits.minDurationMin
    || input.durationMin > limits.maxDurationMin
  ) {
    if (isPro) {
      throw validationFailed(
        `Pro tier durations must be between ${limits.minDurationMin}–${limits.maxDurationMin} minutes.`,
        { durationMin: input.durationMin, min: limits.minDurationMin, max: limits.maxDurationMin },
      );
    }
    const proLimits = PLAN_LIMITS.pro;
    throw proRequired(
      `Free tier sessions are fixed at ${limits.minDurationMin} minutes. Upgrade to Pro for ${proLimits.minDurationMin}–${proLimits.maxDurationMin} minute sessions.`,
    );
  }

  // ── 2. Voice cap ─────────────────────────────────────────────────
  // Reject unknown voice ids regardless of plan, then enforce the
  // per-plan allow-list.
  if (!(input.voiceId in VOICES)) {
    throw validationFailed('Unknown voice id', { voiceId: input.voiceId });
  }
  if (limits.voicesAllowed !== 'all' && !limits.voicesAllowed.includes(input.voiceId)) {
    throw proRequired(
      `This voice is Pro-only. Upgrade to unlock all ${Object.keys(VOICES).length} voices.`,
    );
  }

  // ── 3. Background cap ────────────────────────────────────────────
  if (
    limits.backgroundsAllowed !== 'all'
    && !limits.backgroundsAllowed.includes(input.background)
  ) {
    throw proRequired('This background sound is Pro-only. Upgrade to unlock all sounds.');
  }

  // ── 4. Free lifetime cap ─────────────────────────────────────────
  if (plan === 'free' && limits.sessionsLifetime !== null) {
    if (user.sessionsLifetime >= limits.sessionsLifetime) {
      throw rateLimitExceeded(
        `Free tier limit of ${limits.sessionsLifetime} sessions reached. Upgrade to Pro for ${PLAN_LIMITS.pro.sessionsPerMonth}/month.`,
        {
          limit: limits.sessionsLifetime,
          used: user.sessionsLifetime,
          upgradeUrl: '/upgrade',
        },
      );
    }
  }

  // ── 5. Pro monthly cap (atomic post-increment + re-select) ───────
  const period = isPro && limits.sessionsPerMonth !== null ? currentPeriod() : null;
  if (isPro && period && limits.sessionsPerMonth !== null) {
    const limit = limits.sessionsPerMonth;

    await mysqlDb
      .insert(usageCounters)
      .values({ userId, periodYyyymm: period, generationsCount: 1 })
      .onDuplicateKeyUpdate({
        set: {
          generationsCount: sql`${usageCounters.generationsCount} + 1`,
        },
      });

    const [row] = await mysqlDb
      .select()
      .from(usageCounters)
      .where(
        and(
          eq(usageCounters.userId, userId),
          eq(usageCounters.periodYyyymm, period),
        ),
      )
      .limit(1);
    const used = row?.generationsCount ?? 1;
    if (used > limit) {
      await rollbackUsage(userId, period);
      throw rateLimitExceeded(
        `Monthly Pro limit of ${limit} sessions reached. Resets on the 1st of next month.`,
        { limit, used: limit, resetAt: nextMonthResetIso() },
      );
    }
  }

  // ── 6. Free lifetime increment (must precede session insert so two
  //     concurrent free requests can't both pass the check above) ──
  if (plan === 'free') {
    await mysqlDb
      .update(users)
      .set({ sessionsLifetime: sql`${users.sessionsLifetime} + 1` })
      .where(eq(users.id, userId));
  }

  const sessionId = randomUUID();
  const durationMinutes = input.durationMin;

  try {
    // Step 1: Gemini script generation (includes retry + token
    // accounting + audit log via ai.service). The quick heuristic
    // safety pass runs inside `generateScript`, and sensitive
    // categories (`fears`, `habits`) additionally get an LLM-backed
    // deep safety review there — no second pass needed here.
    const scriptResult = await generateScript({
      userId,
      sessionId,
      prompt: input.userPrompt,
      category: input.category as SessionCategory,
      voiceId: input.voiceId as VoiceId,
      backgroundSound: input.background as BackgroundSound,
      durationMinutes,
      inductionStyle: input.inductionStyle,
      depthLevel: input.depthLevel,
      wakeUpEnding: input.wakeUpAtEnd,
    });

    // Step 2: persist the session row with the real title + script.
    await mysqlDb.insert(sessions).values({
      id: sessionId,
      userId,
      title: scriptResult.title,
      scriptText: scriptResult.scriptText,
      category: input.category as SessionCategory,
      durationSec: durationMinutes * 60,
      voiceId: input.voiceId,
      backgroundSound: input.background,
      status: 'generating',
      isTemplate: false,
    });

    // Step 3: enqueue audio generation with the real script.
    await enqueueAudioGeneration({
      sessionId,
      userId,
      scriptText: scriptResult.scriptText,
      title: scriptResult.title,
      voiceId: input.voiceId as VoiceId,
      backgroundSound: input.background as BackgroundSound,
      durationMinutes,
      isPro,
    });

    logEvent(userId, sessionId, 'session_create', {
      category: input.category,
      durationMin: durationMinutes,
      voiceId: input.voiceId,
      inductionStyle: input.inductionStyle,
      depthLevel: input.depthLevel,
      wakeUpAtEnd: input.wakeUpAtEnd,
      background: input.background,
      tokensInput: scriptResult.tokensInput,
      tokensOutput: scriptResult.tokensOutput,
    });

    return { sessionId, status: 'generating' };
  } catch (err) {
    // Any failure after the increment must roll the counter back so
    // the user doesn't lose a quota slot to a transient error. Pro
    // monthly counter is in `usage_counters`; the free lifetime
    // counter is on `users.sessions_lifetime`.
    if (isPro && period) {
      await rollbackUsage(userId, period);
    } else if (plan === 'free') {
      try {
        await mysqlDb
          .update(users)
          .set({
            sessionsLifetime: sql`GREATEST(${users.sessionsLifetime} - 1, 0)`,
          })
          .where(eq(users.id, userId));
      } catch (rollbackErr) {
        logger.warn(
          { err: rollbackErr, userId },
          'Failed to roll back free-tier lifetime counter',
        );
      }
    }
    throw err;
  }
}

/**
 * Refunds a single generation slot for the *current* UTC month for
 * `userId`. Wrapper around {@link rollbackUsage} that resolves the
 * period internally — used by the audio generation worker's
 * `on('failed')` handler when all retry attempts are exhausted, to
 * give a free-tier user back the quota slot they spent on a job that
 * never produced audio.
 */
export async function refundGeneration(userId: string): Promise<void> {
  await rollbackUsage(userId, currentPeriod());
}

/**
 * Redis key holding a per-session "cancel requested" flag. The
 * audio-generation worker reads this in its `emit()` helper and
 * throws a non-retryable error when set, so a cancel request actually
 * stops the in-flight job rather than letting it run to completion
 * after the user has navigated away.
 *
 * The TTL matches the worker's longest expected runtime; once the
 * job settles the flag is no longer relevant.
 */
export function sessionCancelKey(sessionId: string): string {
  return `session:cancel:${sessionId}`;
}

/**
 * Cancels an in-flight generation. Sets a Redis abort flag the worker
 * checks at each progress emit, marks the session row as `failed`, and
 * refunds the user's monthly quota slot if they're on the free plan.
 *
 * Idempotent — calling cancel on an already-failed or already-ready
 * session is a no-op (no quota refund, no Redis write).
 */
export async function cancelGeneration(
  userId: string,
  sessionId: string,
): Promise<void> {
  const [session] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw notFound('Session');
  if (session.userId !== userId) throw forbidden('Session does not belong to user');

  // Already settled — nothing to cancel and no quota to refund.
  if (session.status !== 'generating') return;

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(sessionCancelKey(sessionId), '1', 'EX', 60 * 30);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to set cancel flag in Redis');
    }
  }

  await mysqlDb
    .update(sessions)
    .set({ status: 'failed' })
    .where(eq(sessions.id, sessionId));

  // Refund the quota slot. Only meaningful for free-tier users; pro
  // users never had a counter incremented in the first place, so the
  // clamp-at-zero in `rollbackUsage` makes this a safe no-op.
  const [user] = await mysqlDb
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user && user.plan !== 'pro') {
    await refundGeneration(userId);
  }

  logEvent(userId, sessionId, 'session_cancel', {});
}

/**
 * Returns true (and clears the flag) if a cancel was requested for
 * the given session. The worker calls this from its `emit()` helper
 * so an aborted job stops emitting and throws on the next step.
 */
export async function consumeCancelFlag(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const value = await redis.get(sessionCancelKey(sessionId));
    return value === '1';
  } catch (err) {
    logger.warn({ err, sessionId }, 'Failed to read session cancel flag');
    return false;
  }
}

/**
 * Persists a user-submitted report against a session as a Postgres
 * analytics event. Centralising the storage means the moderation
 * dashboard (and any future webhook fan-out) only has to read one
 * table.
 *
 * Non-blocking errors (the underlying `logEvent` is fire-and-forget)
 * are logged and swallowed — a flaky analytics insert must never
 * cause a "could not submit report" toast on the user's screen for
 * a report that's effectively been received.
 */
export async function reportSession(
  userId: string,
  sessionId: string,
  reason: string,
  details: string,
): Promise<void> {
  const [session] = await mysqlDb
    .select({ id: sessions.id, userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) throw notFound('Session');

  logEvent(userId, sessionId, 'session_report', {
    reason,
    details: details.slice(0, 500),
    sessionOwnerId: session.userId,
  });
}

/**
 * Decrements the `generationsCount` for a user/period, clamped at 0.
 * Best-effort — a failure here is logged but doesn't propagate because
 * the caller is already handling a primary error.
 */
async function rollbackUsage(userId: string, period: string): Promise<void> {
  try {
    await mysqlDb
      .update(usageCounters)
      .set({
        generationsCount: sql`GREATEST(${usageCounters.generationsCount} - 1, 0)`,
      })
      .where(
        and(
          eq(usageCounters.userId, userId),
          eq(usageCounters.periodYyyymm, period),
        ),
      );
  } catch (err) {
    logger.warn({ err, userId, period }, 'Failed to roll back usage counter');
  }
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
): Promise<DbSession & { scriptPreview: string | null; progress: ProgressSnapshot | null }> {
  const [row] = await mysqlDb
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) throw notFound('Session');

  if (row.userId !== userId && !row.isTemplate) {
    throw forbidden('You do not have access to this session');
  }

  // For in-flight generations, surface the last worker-emitted
  // progress event so a page reload mid-generation can re-render the
  // progress bar without opening a fresh SSE stream.
  const progress = row.status === 'generating'
    ? await readProgressSnapshot(sessionId)
    : null;

  return {
    ...row,
    scriptPreview: row.scriptText ? row.scriptText.slice(0, 200) : null,
    progress,
  };
}

/**
 * Shape returned on `GET /api/sessions/:id` for in-flight generations,
 * mirroring the last SSE event so reloads can re-render the progress
 * bar. All fields correspond to `ProgressEvent` from
 * `queues/events.bus.ts`.
 */
export interface ProgressSnapshot {
  step: string;
  percent: number;
  message: string;
}

/**
 * Reads the last-emitted worker progress event from Redis. Written by
 * `audio-generation.worker.ts` under the {@link progressMirrorKey}
 * defined in `queues/events.bus.ts`, with a short TTL so stale progress
 * snapshots expire quickly. Returns
 * `null` when Redis is not configured, the key has expired, or the
 * payload is malformed — callers should treat `null` as "no progress
 * yet" rather than surfacing it as an error.
 */
async function readProgressSnapshot(
  sessionId: string,
): Promise<ProgressSnapshot | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(progressMirrorKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      step?: string;
      progress?: number;
      message?: string;
    };
    if (!parsed.step) return null;
    return {
      step: parsed.step,
      percent: parsed.progress ?? 0,
      message: parsed.message ?? '',
    };
  } catch (err) {
    logger.debug({ err, sessionId }, 'Failed to read progress snapshot');
    return null;
  }
}

/**
 * Result of {@link getAudioUrl}: a presigned stream URL plus the ISO
 * timestamp at which it expires. Returned to clients as
 * `{ data: { url, expiresAt } }` so a player can pre-emptively refresh.
 */
export interface AudioUrlResult {
  url: string;
  expiresAt: string;
}

/** Presigned URL TTLs by plan, in seconds. */
const FREE_URL_TTL_SEC = 3600; // 1 hour
const PRO_URL_TTL_SEC = 86400; // 24 hours — supports offline downloads

/**
 * Returns a presigned S3 URL for the session's final mixed audio,
 * plus the ISO timestamp at which the URL expires.
 *
 * Refuses with 409 when the session has not finished generating yet,
 * because there is no object to sign. Access control mirrors
 * {@link getSessionById}: owner OR template.
 *
 * TTL is plan-dependent: Pro users get 24h URLs (so playback survives
 * offline use and long sessions), Free users get 1h URLs. Results are
 * memoized in Redis (`audio:url:<plan>:<sessionId>`) for ~55 minutes
 * to avoid re-signing for hot templates on the read path.
 */
export async function getAudioUrl(
  userId: string,
  sessionId: string,
): Promise<AudioUrlResult> {
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

  const [user] = await mysqlDb
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const plan: 'free' | 'pro' = user?.plan === 'pro' ? 'pro' : 'free';
  const ttlSec = plan === 'pro' ? PRO_URL_TTL_SEC : FREE_URL_TTL_SEC;

  // Read-through cache. The cached entry carries the URL's real
  // signing expiry, so we never overstate the remaining validity on
  // a cache hit.
  const cached = await getCachedStreamUrl(sessionId, plan);
  if (cached) {
    return { url: cached.url, expiresAt: cached.expiresAt };
  }

  const key = buildSessionKey(row.userId, row.id);
  const url = await getStreamUrl(key, ttlSec);
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  await setCachedStreamUrl(sessionId, plan, url, expiresAt);

  return { url, expiresAt };
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

  await invalidateAudioCache(sessionId);

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

  // Existing presigned URLs point at the previous mix; drop them so
  // the next `getAudioUrl` re-signs against the regenerated object.
  await invalidateAudioCache(sessionId);

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
