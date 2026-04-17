import { pgTable, uuid, text, date, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * AI-generated weekly recap for a user. Keyed by (userId, weekStart); the
 * index allows fast lookup of the latest N weeks per user.
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
