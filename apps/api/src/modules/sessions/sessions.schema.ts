import { z } from 'zod';
import { SESSION_CATEGORIES, SESSION_STATUSES } from '../../config/constants.js';

/**
 * Query parameters for listing sessions.
 */
export const listSessionsSchema = z.object({
  category: z.enum(SESSION_CATEGORIES).optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  isTemplate: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSessionsQuery = z.infer<typeof listSessionsSchema>;

/**
 * Path parameter for session ID.
 */
export const sessionIdSchema = z.object({
  id: z.string().uuid('Invalid session ID'),
});
