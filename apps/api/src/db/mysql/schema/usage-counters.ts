import { mysqlTable, varchar, int, primaryKey } from 'drizzle-orm/mysql-core';
import { users } from './users.js';

/**
 * Per-user, per-calendar-month generation counters used to enforce
 * free-tier limits. Period is encoded as "YYYYMM" for cheap range queries
 * and cheap indexing.
 */
export const usageCounters = mysqlTable(
  'usage_counters',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodYyyymm: varchar('period_yyyymm', { length: 6 }).notNull(), // "202604"
    generationsCount: int('generations_count').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.periodYyyymm] }),
  }),
);

export type UsageCounter = typeof usageCounters.$inferSelect;
export type NewUsageCounter = typeof usageCounters.$inferInsert;
