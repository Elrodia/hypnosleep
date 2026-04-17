import { pgTable, uuid, text, date, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * AI-generated weekly recap for a user. Rows are identified by their own
 * `id`; `(userId, weekStart)` is a non-unique index that allows fast
 * lookup of the latest N weeks per user but does *not* enforce a single
 * insight per user/week — callers may write multiple rows for the same
 * `(userId, weekStart)` pair (e.g. regenerations) and should pick the
 * latest by `createdAt`.
 */
export const weeklyInsights = pgTable(
  'weekly_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    insightText: text('insight_text').notNull(),
    weekStart: date('week_start').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userWeekIdx: index('insights_user_week_idx').on(t.userId, t.weekStart),
  }),
);

export type WeeklyInsight = typeof weeklyInsights.$inferSelect;
export type NewWeeklyInsight = typeof weeklyInsights.$inferInsert;
