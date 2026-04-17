import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Append-only event log for product analytics. Every meaningful user
 * action is written here; downstream insights (streaks, weekly recaps)
 * are derived from this table.
 *
 * event_type values include: signup, login, session_create, session_play,
 * session_complete, session_favorite, mood_logged, paywall_shown,
 * upgrade_clicked, trial_started, subscription_created,
 * subscription_canceled.
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    sessionId: uuid('session_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('events_user_idx').on(t.userId, t.createdAt),
    typeIdx: index('events_type_idx').on(t.eventType, t.createdAt),
  }),
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
