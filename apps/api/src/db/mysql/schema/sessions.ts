import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  mysqlEnum,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Hypnotherapy sessions generated for or saved by a user. Templates
 * (isTemplate=true) are seed content shared across all users.
 */
export const sessions = mysqlTable(
  'sessions',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    scriptText: text('script_text'),
    category: mysqlEnum('category', [
      'sleep',
      'confidence',
      'fears',
      'habits',
      'focus',
      'anxiety',
      'custom',
    ]).notNull(),
    durationSec: int('duration_sec').notNull(),
    voiceId: varchar('voice_id', { length: 64 }).notNull(),
    backgroundSound: varchar('background_sound', { length: 32 }).default('silence'),
    audioUrl: varchar('audio_url', { length: 1024 }),
    playCount: int('play_count').notNull().default(0),
    isTemplate: boolean('is_template').notNull().default(false),
    status: mysqlEnum('status', ['generating', 'ready', 'failed']).notNull().default('generating'),
    createdAt: timestamp('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    userIdIdx: index('user_id_idx').on(t.userId),
    templateIdx: index('template_idx').on(t.isTemplate),
    categoryIdx: index('category_idx').on(t.category),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
