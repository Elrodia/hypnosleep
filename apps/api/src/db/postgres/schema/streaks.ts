import { pgTable, uuid, integer, date, timestamp } from 'drizzle-orm/pg-core';

/**
 * One row per user tracking their current and longest listening streak.
 * Updated by a nightly job (or on listen events) based on `mood_logs` /
 * `events` aggregates.
 */
export const streaks = pgTable('streaks', {
  userId: uuid('user_id').primaryKey(),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastListenDate: date('last_listen_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
