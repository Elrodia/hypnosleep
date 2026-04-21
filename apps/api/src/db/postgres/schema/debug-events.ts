import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Persistent, queryable debug/diagnostic event log.
 *
 * Every OAuth failure, unhandled 5xx error, and (optionally sampled)
 * 4xx response is appended here, keyed by the per-request `rid` that
 * the API echoes back on `/auth/error` and the `X-Request-Id`
 * response header. Operators can look a user's "Support reference"
 * up directly instead of grepping stdout on a single host.
 *
 * Security:
 *   - Bodies, bearer tokens, auth codes, refresh tokens and raw
 *     `error_description` HTML blobs are never written here — the
 *     `recordDebugEvent` service layer redacts defensively before
 *     insert (see `services/debug-log.service.ts`).
 *   - `ip_hash` stores `sha256(ip + pepper)` — a one-way fingerprint
 *     that supports "same-user repeated failures" grouping without
 *     ever storing the raw IP.
 *
 * Retention: rows older than `DEBUG_LOG_RETENTION_DAYS` (default 30)
 * are pruned by the `startDebugEventsPruneJob` background cron.
 */
export const debugEvents = pgTable(
  'debug_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Request correlation id (UUIDv4). Multiple rows can share a `rid`
     * when a single request generates multiple debug events (e.g. an
     * OAuth provider_error that is also captured by the global 5xx
     * handler).
     */
    rid: varchar('rid', { length: 64 }).notNull(),
    /** ISO log level: `trace` | `debug` | `info` | `warn` | `error` | `fatal`. */
    level: varchar('level', { length: 8 }).notNull(),
    /** Coarse bucket: `oauth`, `subscription`, `ai`, `http_5xx`, `http_4xx`, ... */
    category: varchar('category', { length: 32 }).notNull(),
    /** Free-form machine-readable reason (e.g. `state_missing`, `callback_failed`). */
    reason: varchar('reason', { length: 64 }),
    /** Authenticated user id (nullable — pre-auth failures won't have one). */
    userId: varchar('user_id', { length: 36 }),
    /** Human-readable summary. Max ~1 KB to keep rows compact. */
    message: text('message').notNull(),
    /** Redacted structured context. */
    context: jsonb('context'),
    errorName: varchar('error_name', { length: 128 }),
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 64 }),
    httpStatus: integer('http_status'),
    method: varchar('method', { length: 8 }),
    /** Request path WITHOUT query string. */
    path: varchar('path', { length: 512 }),
    userAgent: varchar('user_agent', { length: 512 }),
    /** `sha256(ip + DEBUG_LOG_IP_HASH_PEPPER)` — never the raw IP. */
    ipHash: varchar('ip_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ridIdx: index('debug_events_rid_idx').on(t.rid, t.createdAt),
    categoryIdx: index('debug_events_category_idx').on(t.category, t.createdAt),
    userIdx: index('debug_events_user_idx').on(t.userId, t.createdAt),
    createdIdx: index('debug_events_created_idx').on(t.createdAt),
  }),
);

export type DebugEvent = typeof debugEvents.$inferSelect;
export type NewDebugEvent = typeof debugEvents.$inferInsert;
