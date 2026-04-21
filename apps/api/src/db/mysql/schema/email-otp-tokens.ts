import {
  mysqlTable,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/**
 * Short-lived one-time passwords used for passwordless email sign-in.
 *
 * The OTP itself is never stored in plain text — the `token_hash` column
 * holds a SHA-256 hex digest of the 6-digit code so a DB read does not
 * directly expose a valid token. Each row is single-use (`used_at` is set
 * on successful verification) and expires after 10 minutes.
 */
export const emailOtpTokens = mysqlTable(
  'email_otp_tokens',
  {
    id: varchar('id', { length: 36 }).primaryKey(), // UUID v4
    email: varchar('email', { length: 320 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    tokenHashUnique: uniqueIndex('email_otp_tokens_token_hash_uq').on(t.tokenHash),
    emailIdx: index('email_otp_tokens_email_idx').on(t.email),
    expiresAtIdx: index('email_otp_tokens_expires_at_idx').on(t.expiresAt),
  }),
);

export type EmailOtpToken = typeof emailOtpTokens.$inferSelect;
export type NewEmailOtpToken = typeof emailOtpTokens.$inferInsert;
