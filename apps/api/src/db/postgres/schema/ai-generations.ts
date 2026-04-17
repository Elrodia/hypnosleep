import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Audit log of every AI script generation: tokens in/out, latency, model,
 * and failure reason. Used for cost analysis and debugging.
 */
export const aiGenerations = pgTable(
  'ai_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    sessionId: uuid('session_id').notNull(),
    promptText: text('prompt_text').notNull(),
    model: varchar('model', { length: 64 }).notNull(),
    tokensInput: integer('tokens_input'),
    tokensOutput: integer('tokens_output'),
    generationMs: integer('generation_ms'),
    voice: varchar('voice', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(), // success, failed
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('ai_gen_user_idx').on(t.userId, t.createdAt),
  }),
);

export type AiGeneration = typeof aiGenerations.$inferSelect;
export type NewAiGeneration = typeof aiGenerations.$inferInsert;
