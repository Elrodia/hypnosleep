import { mysqlTable, varchar, timestamp, primaryKey } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { sessions } from './sessions.js';

/**
 * Many-to-many join of users → favorited sessions. Composite primary key
 * (userId, sessionId) avoids duplicates without a separate unique index.
 */
export const favorites = mysqlTable(
  'favorites',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: varchar('session_id', { length: 36 })
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sessionId] }),
  }),
);

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
