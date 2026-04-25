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
  // `strict: false` so that `drizzle-kit migrate` does not prompt for
  // interactive confirmation. In a non-interactive deploy container
  // (Railway's pre-deploy hook) `strict: true` causes the process to
  // hang forever waiting on stdin, which previously caused the
  // `/health` healthcheck to time out before the server ever started.
  strict: false,
} satisfies Config;
