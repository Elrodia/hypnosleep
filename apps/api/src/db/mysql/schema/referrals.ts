import { mysqlTable, varchar, boolean, timestamp } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Tracks which user referred which other user and whether the reward has
 * been applied. `referredId` is unique so each user can only be referred
 * once.
 */
export const referrals = mysqlTable('referrals', {
  id: varchar('id', { length: 36 }).primaryKey(),
  referrerId: varchar('referrer_id', { length: 36 })
    .notNull()
    .references(() => users.id),
  referredId: varchar('referred_id', { length: 36 })
    .notNull()
    .references(() => users.id)
    .unique(),
  rewardApplied: boolean('reward_applied').notNull().default(false),
  createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
