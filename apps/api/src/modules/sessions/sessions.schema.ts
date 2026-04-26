import { z } from 'zod';
import {
  SESSION_CATEGORIES,
  BACKGROUND_SOUNDS,
  INDUCTION_STYLES,
  DEPTH_LEVELS,
  MIN_SESSION_DURATION_SEC,
  MAX_SESSION_DURATION_SEC,
} from '../../config/constants.js';

/**
 * "All" + every supported category. Used for the library list filter
 * where "all" means "no category constraint".
 */
const LIST_CATEGORIES = ['all', ...SESSION_CATEGORIES] as const;

/** Sort order keywords accepted by the library list endpoint. */
export const LIST_SORTS = [
  'newest',
  'oldest',
  'most_played',
  'shortest',
  'longest',
] as const;
export type ListSort = (typeof LIST_SORTS)[number];

/**
 * Body schema for `POST /api/sessions/generate`.
 *
 * Voice ids are validated by the service layer (against the
 * `VOICES` registry) so we can return a friendlier error message
 * that includes the voice's display label.
 */
export const generateSessionSchema = z.object({
  userPrompt: z.string().min(10).max(500),
  durationMin: z
    .number()
    .int()
    .min(MIN_SESSION_DURATION_SEC / 60)
    .max(MAX_SESSION_DURATION_SEC / 60),
  voiceId: z.string().min(1).max(64),
  inductionStyle: z.enum(INDUCTION_STYLES),
  depthLevel: z.enum(DEPTH_LEVELS),
  wakeUpAtEnd: z.boolean(),
  background: z.enum(BACKGROUND_SOUNDS),
  category: z.enum(SESSION_CATEGORIES),
});

export type GenerateSessionInput = z.infer<typeof generateSessionSchema>;

/**
 * Query schema for `GET /api/sessions`.
 *
 * Strings come in via query string so booleans and numbers must be
 * coerced. Defaults are applied so the route handler can rely on
 * fully-populated input regardless of what the client sends.
 */
export const listSessionsQuerySchema = z.object({
  category: z.enum(LIST_CATEGORIES).default('all'),
  search: z.string().max(100).optional(),
  sort: z.enum(LIST_SORTS).default('newest'),
  favoritesOnly: z.coerce.boolean().default(false),
  includeTemplates: z.coerce.boolean().default(true),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

/** Body schema for `PUT /api/sessions/:id/script`. */
export const editScriptSchema = z.object({
  scriptText: z.string().min(50).max(20000),
});

export type EditScriptInput = z.infer<typeof editScriptSchema>;

/** Body schema for `POST /api/sessions/:id/regenerate`. */
export const regenerateSchema = z.object({
  voiceId: z.string().min(1).max(64).optional(),
  background: z.enum(BACKGROUND_SOUNDS).optional(),
});

export type RegenerateInput = z.infer<typeof regenerateSchema>;

/** Path parameter for session ID. */
export const sessionIdSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
});

/** Body schema for `POST /api/sessions/:id/report`. */
export const reportSessionSchema = z.object({
  reason: z.enum(['inappropriate', 'inaccurate', 'unsafe', 'low_quality', 'other']),
  details: z.string().max(500).optional().default(''),
});

export type ReportSessionInput = z.infer<typeof reportSessionSchema>;

/**
 * @deprecated Kept as an alias for back-compat with earlier callers.
 * Prefer {@link listSessionsQuerySchema}.
 */
export const listSessionsSchema = listSessionsQuerySchema;
