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
  strict: true,
} satisfies Config;
