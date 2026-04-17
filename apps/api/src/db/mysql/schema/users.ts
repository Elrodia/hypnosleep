import {
  mysqlTable,
  varchar,
  timestamp,
  json,
  mysqlEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/**
 * Core user accounts. Lives in MySQL because it's transactional data
 * tightly coupled to billing, sessions, and referrals.
 */
export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    oauthProvider: mysqlEnum('oauth_provider', ['google', 'github', 'microsoft']).notNull(),
    oauthId: varchar('oauth_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 1024 }),
    plan: mysqlEnum('plan', ['free', 'pro']).notNull().default('free'),
    preferences: json('preferences').$type<{
      goals: string[];
      preferredTime: 'before_sleep' | 'morning' | 'breaks' | 'anytime';
      defaultDuration: number; // 5-30 minutes
      defaultVoice: string;
      defaultBackground: string;
      theme: 'dark' | 'light';
      dailyReminderTime?: string; // "22:00"
    }>(),
    referralCode: varchar('referral_code', { length: 12 }).notNull().unique(),
    referredBy: varchar('referred_by', { length: 36 }), // FK to users.id
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => ({
    oauthLookup: uniqueIndex('users_oauth_lookup').on(t.oauthProvider, t.oauthId),
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
