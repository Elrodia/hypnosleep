import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config for the MySQL core database.
 *
 * Usage:
 *   npm run db:mysql:generate   # diff schema → SQL migration
 *   npm run db:mysql:migrate    # apply pending migrations
 *   npm run db:mysql:studio     # open Drizzle Studio
 */
export default {
  schema: './src/db/mysql/schema/*',
  out: './src/db/mysql/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.MYSQL_URL ?? '',
  },
  verbose: true,
  strict: true,
} satisfies Config;
