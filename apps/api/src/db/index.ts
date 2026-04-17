/**
 * Database barrel.
 *
 * The HypnoSleep API deliberately runs **two relational databases**:
 *
 *   - **MySQL** (`mysqlDb`) — core transactional store: users, sessions,
 *     subscriptions, favorites, referrals, usage counters. Low-latency
 *     row-oriented access for user-facing paths.
 *   - **PostgreSQL** (`pgDb`) — analytics / derived store: event log,
 *     mood logs, AI generation audit, streaks, weekly insights. Rich
 *     types (jsonb, timestamptz, check constraints) and room to run
 *     heavy analytical queries without risking OLTP latency.
 *
 * Redis (`redis`) is used for caching, rate-limiting, and BullMQ queues.
 *
 * Each database has its own schema folder, its own Drizzle client, and
 * its own migrations folder under `src/db/{mysql,postgres}/migrations`.
 */
export { mysqlDb, type MySQLDb } from './mysql/client.js';
export { pgDb, type PgDb } from './postgres/client.js';
export { redis, getRedis, closeRedis } from './redis/client.js';
export { checkRateLimit, cached, invalidateCache } from './redis/helpers.js';
