import { pgTable, uuid, integer, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Post-session mood rating on a 1-5 scale with an optional free-text
 * note. Used to power mood trend charts and AI insights.
 */
export const moodLogs = pgTable(
  'mood_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    rating: integer('rating').notNull(), // 1-5
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('mood_user_idx').on(t.userId, t.createdAt),
    ratingCheck: check('rating_range', sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  }),
);

export type MoodLog = typeof moodLogs.$inferSelect;
export type NewMoodLog = typeof moodLogs.$inferInsert;
