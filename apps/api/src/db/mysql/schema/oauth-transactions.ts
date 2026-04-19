import { mysqlTable, varchar, timestamp, mysqlEnum, index, uniqueIndex } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const oauthTransactions = mysqlTable(
  'oauth_transactions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    provider: mysqlEnum('provider', ['google', 'github', 'microsoft']).notNull(),
    stateNonce: varchar('state_nonce', { length: 128 }).notNull(),
    pkceVerifier: varchar('pkce_verifier', { length: 255 }),
    referralCode: varchar('referral_code', { length: 32 }),
    userAgentHash: varchar('user_agent_hash', { length: 64 }),
    ipHash: varchar('ip_hash', { length: 64 }),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    stateNonceUnique: uniqueIndex('oauth_transactions_state_nonce_uq').on(t.stateNonce),
    expiresAtIdx: index('oauth_transactions_expires_at_idx').on(t.expiresAt),
    consumedAtIdx: index('oauth_transactions_consumed_at_idx').on(t.consumedAt),
  }),
);

export type OAuthTransaction = typeof oauthTransactions.$inferSelect;
export type NewOAuthTransaction = typeof oauthTransactions.$inferInsert;
