import type { Config } from 'drizzle-kit';

/**
 * Drizzle Kit config for the PostgreSQL analytics database.
 *
 * Usage:
 *   npm run db:pg:generate   # diff schema → SQL migration
 *   npm run db:pg:migrate    # apply pending migrations
 *   npm run db:pg:studio     # open Drizzle Studio
 */
export default {
  schema: './src/db/postgres/schema/*',
  out: './src/db/postgres/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  // `strict: false` so that `drizzle-kit migrate` does not prompt for
  // interactive confirmation. In a non-interactive deploy container
  // (Railway's pre-deploy hook) `strict: true` causes the process to
  // hang forever waiting on stdin, which previously caused the
  // `/health` healthcheck to time out before the server ever started.
  strict: false,
} satisfies Config;
