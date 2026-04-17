import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';
import { env } from '../../config/env.js';

const { Pool } = pg;

/**
 * PostgreSQL Drizzle client. Postgres hosts **analytics and derived**
 * data: event logs, mood ratings, AI generation audit rows, streaks, and
 * weekly insights. Splitting these from core MySQL lets us scale
 * analytical workloads (long scans, jsonb queries) independently of the
 * OLTP workload.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const pgDb = drizzle(pool, { schema });
export type PgDb = typeof pgDb;
