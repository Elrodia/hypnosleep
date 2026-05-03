import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema/index.js';
import { env } from '../../config/env.js';

/**
 * MySQL Drizzle client. MySQL hosts the **core transactional** dataset:
 * users, sessions, subscriptions, favorites, referrals, and usage
 * counters. We deliberately keep analytics data out of this database so
 * that heavy analytical queries can't degrade the user-facing paths.
 */
const pool = mysql.createPool({
  uri: env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

// TEMPORARY: `logger: true` prints every Drizzle-generated SQL
// statement to stdout (visible in Railway deploy logs). Enabled to
// diagnose a Library-list bug where the API returns 0 rows for a
// query whose hand-written equivalent returns the expected row.
// REMOVE this option once the bug is identified and fixed.
export const mysqlDb = drizzle(pool, { schema, mode: 'default', logger: true });
export type MySQLDb = typeof mysqlDb;
