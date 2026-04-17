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

export const mysqlDb = drizzle(pool, { schema, mode: 'default' });
export type MySQLDb = typeof mysqlDb;
