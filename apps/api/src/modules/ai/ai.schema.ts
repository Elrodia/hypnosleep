import { z } from 'zod';
import {
  SESSION_CATEGORIES,
  BACKGROUND_SOUNDS,
  INDUCTION_STYLES,
  DEPTH_LEVELS,
  VOICES,
  MIN_SESSION_DURATION_SEC,
  MAX_SESSION_DURATION_SEC,
} from '../../config/constants.js';

const voiceIds = Object.keys(VOICES) as [string, ...string[]];

/**
 * Zod schema for the session generation request body.
 */
export const generateSessionSchema = z.object({
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(500, 'Prompt must be at most 500 characters'),
  category: z.enum(SESSION_CATEGORIES).default('custom'),
  voiceId: z.enum(voiceIds).default('en-US-AnaNeural'),
  backgroundSound: z.enum(BACKGROUND_SOUNDS).default('rain'),
  durationMinutes: z
    .number()
    .int()
    .min(MIN_SESSION_DURATION_SEC / 60, `Minimum duration is ${MIN_SESSION_DURATION_SEC / 60} minutes`)
    .max(MAX_SESSION_DURATION_SEC / 60, `Maximum duration is ${MAX_SESSION_DURATION_SEC / 60} minutes`)
    .default(15),
  inductionStyle: z.enum(INDUCTION_STYLES).default('progressive'),
  depthLevel: z.enum(DEPTH_LEVELS).default('medium'),
  wakeUpEnding: z.boolean().default(true),
});

export type GenerateSessionBody = z.infer<typeof generateSessionSchema>;

/**
 * Zod schema for regenerating a specific paragraph of a script.
 */
export const regenerateParagraphSchema = z.object({
  sessionId: z.string().uuid(),
  paragraphIndex: z.number().int().min(0),
  context: z.object({
    previousParagraph: z.string().nullable(),
    currentParagraph: z.string().min(1),
    nextParagraph: z.string().nullable(),
  }),
});

export type RegenerateParagraphBody = z.infer<typeof regenerateParagraphSchema>;
