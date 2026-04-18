import { sql, eq, and, gte } from 'drizzle-orm';
import { pgDb } from '../../db/postgres/client.js';
import { mysqlDb } from '../../db/mysql/client.js';
import { moodLogs } from '../../db/postgres/schema/mood-logs.js';
import { events } from '../../db/postgres/schema/events.js';
import { streaks } from '../../db/postgres/schema/streaks.js';
import { weeklyInsights } from '../../db/postgres/schema/weekly-insights.js';
import { sessions } from '../../db/mysql/schema/sessions.js';
import { logger } from '../../utils/logger.js';
import { generateWeeklyInsight } from './progress.insights.js';
import type { MoodLogInput } from './progress.schema.js';

/** Milliseconds in a UTC day — used for day-diffing listen dates. */
const DAY_MS = 86_400_000;

/**
 * Returns the current date as a `YYYY-MM-DD` string in UTC. Keeping
 * streak math in UTC avoids DST/host-timezone inconsistencies between
 * the API and whatever region the user is browsing from.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the ISO week-start (Monday) for the current UTC date as a
 * `YYYY-MM-DD` string. Used as the natural key for cached weekly
 * insights so a single insight is generated per user per week.
 */
function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  // Shift Sunday (0) to behave like 7 so Monday-start math works.
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  return monday.toISOString().slice(0, 10);
}

/**
 * Fire-and-forget analytics event write. Postgres outages must never
 * block the user-facing mood-log path, so the promise is explicitly
 * dropped after attaching a warn-level catch.
 */
function logEvent(
  userId: string,
  sessionId: string | null,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  void pgDb
    .insert(events)
    .values({ userId, sessionId, eventType, metadata: metadata ?? null })
    .catch((err: unknown) => {
      logger.warn({ err, eventType, userId }, 'Failed to log analytics event');
    });
}

/**
 * Atomically updates the user's current/longest streak based on
 * today's listen:
 *  - Same UTC day as `last_listen_date` → no-op (already counted)
 *  - Exactly one UTC day after last listen → increment current streak
 *  - Any larger gap (or first row) → reset current streak to 1
 *
 * `longest_streak` is never decreased. First-time callers get an
 * initialized row with both counters at 1.
 */
async function updateStreak(userId: string): Promise<void> {
  const today = todayUtc();

  await pgDb.transaction(async (tx) => {
    await tx
      .insert(streaks)
      .values({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastListenDate: today,
      })
      .onConflictDoNothing({ target: streaks.userId });

    const [current] = await tx
      .select()
      .from(streaks)
      .where(eq(streaks.userId, userId))
      .limit(1);

    if (!current || current.lastListenDate === today) return;

    let newStreak = 1;
    if (current.lastListenDate) {
      const last = new Date(current.lastListenDate);
      const todayDate = new Date(today);
      const dayDiff = Math.floor(
        (todayDate.getTime() - last.getTime()) / DAY_MS,
      );
      if (dayDiff === 1) newStreak = current.currentStreak + 1;
    }

    await tx
      .update(streaks)
      .set({
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, current.longestStreak),
        lastListenDate: today,
        updatedAt: new Date(),
      })
      .where(eq(streaks.userId, userId));
  });
}

/**
 * Records a post-session mood rating (1-5 + optional note) and
 * advances the user's streak. A `mood_logged` analytics event is
 * written best-effort so dashboards can see mood-logging engagement.
 */
export async function logMood(userId: string, input: MoodLogInput) {
  await pgDb.insert(moodLogs).values({
    userId,
    sessionId: input.sessionId,
    rating: input.rating,
    note: input.note,
  });

  logEvent(userId, input.sessionId, 'mood_logged', { rating: input.rating });

  await updateStreak(userId);

  return { ok: true };
}

/**
 * High-level dashboard stats: total completed sessions, total
 * listening minutes, and the user's current/longest streak. Only
 * sessions with `status = 'ready'` are counted so in-flight
 * generations don't inflate the totals.
 */
export async function getStats(userId: string) {
  const [totals] = await mysqlDb
    .select({
      totalSessions: sql<number>`COUNT(*)`,
      totalSec: sql<number>`COALESCE(SUM(${sessions.durationSec}), 0)`,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.status, 'ready')));

  const [streak] = await pgDb
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId))
    .limit(1);

  const totalSessions = Number(totals?.totalSessions ?? 0);
  const totalSec = Number(totals?.totalSec ?? 0);

  return {
    totalSessions,
    totalMinutes: Math.round(totalSec / 60),
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
  };
}

/**
 * Returns just the streak counters and the most recent listen date.
 * Zeros are returned when no streak row exists yet.
 */
export async function getStreak(userId: string) {
  const [s] = await pgDb
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId))
    .limit(1);

  return {
    currentStreak: s?.currentStreak ?? 0,
    longestStreak: s?.longestStreak ?? 0,
    lastListenDate: s?.lastListenDate ?? null,
  };
}

/**
 * Day-bucketed listen activity for the last N days, suitable for
 * rendering a GitHub-style heatmap. Only `session_play` events are
 * counted so mood logs / generations don't pollute the visualization.
 */
export async function getHeatmap(userId: string, days: number) {
  const since = new Date(Date.now() - days * DAY_MS);

  const rows = await pgDb
    .select({
      date: sql<string>`DATE(${events.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.eventType, 'session_play'),
        gte(events.createdAt, since),
      ),
    )
    .groupBy(sql`DATE(${events.createdAt})`);

  return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

/**
 * Average mood rating per UTC day for the last N days, ordered
 * chronologically. `avgRating` is rounded to two decimals for clean
 * client rendering.
 */
export async function getMoodTrend(userId: string, days: number) {
  const since = new Date(Date.now() - days * DAY_MS);

  const rows = await pgDb
    .select({
      date: sql<string>`DATE(${moodLogs.createdAt})`,
      avgRating: sql<number>`AVG(${moodLogs.rating})::float`,
      count: sql<number>`COUNT(*)`,
    })
    .from(moodLogs)
    .where(
      and(eq(moodLogs.userId, userId), gte(moodLogs.createdAt, since)),
    )
    .groupBy(sql`DATE(${moodLogs.createdAt})`)
    .orderBy(sql`DATE(${moodLogs.createdAt})`);

  return rows.map((r) => ({
    date: r.date,
    avgRating: Number(Number(r.avgRating).toFixed(2)),
    count: Number(r.count),
  }));
}

/**
 * Returns the AI-generated weekly reflection for the current ISO
 * week, lazily generating and persisting it on the first call per
 * user per week. Subsequent calls within the same week return the
 * cached row so a single Gemini call funds the whole week's views.
 */
export async function getWeeklyInsight(userId: string) {
  const weekStart = getWeekStart();

  const [existing] = await pgDb
    .select()
    .from(weeklyInsights)
    .where(
      and(
        eq(weeklyInsights.userId, userId),
        eq(weeklyInsights.weekStart, weekStart),
      ),
    )
    .limit(1);

  if (existing) {
    return { insight: existing.insightText, weekStart };
  }

  const insightText = await generateWeeklyInsight(userId, weekStart);

  await pgDb.insert(weeklyInsights).values({
    userId,
    insightText,
    weekStart,
  });

  return { insight: insightText, weekStart };
}
