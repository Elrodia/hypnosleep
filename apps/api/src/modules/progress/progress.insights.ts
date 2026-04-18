import { sql, eq, and, gte, inArray } from 'drizzle-orm';
import { pgDb } from '../../db/postgres/client.js';
import { mysqlDb } from '../../db/mysql/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { moodLogs } from '../../db/postgres/schema/mood-logs.js';
import { sessions } from '../../db/mysql/schema/sessions.js';
import { callGemini } from '../ai/ai.gemini.js';
import { logger } from '../../utils/logger.js';

/**
 * Hard cap on the length of the Gemini-generated reflection we persist.
 * Keeps rogue model output from bloating the `weekly_insights` table.
 */
const MAX_INSIGHT_LENGTH = 600;

/**
 * Produces a canned, encouraging reflection used when the user has
 * only a handful of data points (or none) for the week. Keeping this
 * out of the main prompt avoids wasting a Gemini call on trivial
 * input and gives us a deterministic fallback for tests.
 */
function fallbackLowDataInsight(): string {
  return (
    "You've been getting started this week. Even one session can plant the seed of change. " +
    'Try to listen 3-4 times next week to build momentum — consistency is where transformation lives.'
  );
}

/**
 * Builds a string representation of the most common category from an
 * array of session categories, or `null` if no sessions were logged.
 * Ties are broken by first occurrence which is fine for display.
 */
function topCategory(categories: string[]): string | null {
  if (categories.length === 0) return null;
  const counts = new Map<string, number>();
  for (const c of categories) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best?.[0] ?? null;
}

/**
 * Generates a personalized weekly reflection via Gemini.
 *
 * Pulls last-7-days session activity and mood logs for the user, runs
 * aggregates (total listens, top category, average mood, recent notes)
 * and asks Gemini for a short warm reflection. Any Gemini error falls
 * back to a deterministic stat-based string so the caller always gets
 * an insight — this function is invoked on a user-facing path and must
 * not throw.
 */
export async function generateWeeklyInsight(
  userId: string,
  weekStart: string,
): Promise<string> {
  const since = new Date(weekStart);

  const playEvents = await pgDb
    .select({ sessionId: events.sessionId, createdAt: events.createdAt })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.eventType, 'session_play'),
        gte(events.createdAt, since),
      ),
    );

  const sessionPlayCounts = new Map<string, number>();
  for (const event of playEvents) {
    const sessionId = event.sessionId;
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      sessionPlayCounts.set(sessionId, (sessionPlayCounts.get(sessionId) ?? 0) + 1);
    }
  }

  const sessionIds = [...sessionPlayCounts.keys()];

  let categories: string[] = [];
  if (sessionIds.length > 0) {
    const cats = await mysqlDb
      .select({ id: sessions.id, category: sessions.category })
      .from(sessions)
      .where(inArray(sessions.id, sessionIds));
    categories = cats.flatMap((c) =>
      Array.from(
        { length: sessionPlayCounts.get(c.id) ?? 0 },
        () => c.category,
      ),
    );
  }

  const moods = await pgDb
    .select({ rating: moodLogs.rating, note: moodLogs.note })
    .from(moodLogs)
    .where(and(eq(moodLogs.userId, userId), gte(moodLogs.createdAt, since)));

  const totalListens = playEvents.length;
  const avgMood =
    moods.length > 0
      ? (moods.reduce((s, m) => s + m.rating, 0) / moods.length).toFixed(1)
      : null;
  const category = topCategory(categories);
  const moodNotes = moods
    .filter((m) => !!m.note)
    // Truncate each note defensively — the schema allows up to 500
    // chars per note, so five notes could add ~2.5KB of unstructured
    // text to the prompt. Cap each to 120 chars so the prompt stays
    // predictably sized regardless of user input.
    .map((m) => {
      const note = (m.note as string).trim();
      return note.length > 120 ? `${note.slice(0, 117)}...` : note;
    })
    .slice(0, 5);

  if (totalListens < 2) {
    return fallbackLowDataInsight();
  }

  const prompt = `You are a warm, encouraging hypnotherapist writing a weekly reflection for your client.

Their week:
- ${totalListens} hypnosis sessions completed
- Most-used category: ${category ?? 'varied'}
- Average mood rating after sessions: ${avgMood ?? 'not tracked'}/5
- Notes they shared: ${moodNotes.length > 0 ? moodNotes.map((n) => `"${n}"`).join(', ') : 'none'}

Write a short, personal reflection (3-4 sentences max, ~80 words). Tone: warm, observant, encouraging. Avoid generic praise. Reference specific patterns. End with a gentle suggestion for next week.

Output ONLY the reflection text. No quotes, no markdown, no preamble.`;

  try {
    const { text } = await callGemini(prompt);
    return text.trim().slice(0, MAX_INSIGHT_LENGTH);
  } catch (err) {
    logger.error({ err, userId }, 'Weekly insight generation failed');
    return `You completed ${totalListens} sessions this week. Each one is a small investment in yourself. Keep going.`;
  }
}
