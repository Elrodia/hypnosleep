import { Router } from 'express';
import { authenticate, authenticateFromQuery } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleGenerateSession,
  handleRegenerateParagraph,
} from './ai.controller.js';
import { sessionEventsHandler } from '../sessions/sessions.sse.js';

const router = Router();

/**
 * AI module routes.
 * All routes require authentication and are rate-limited.
 */

/** Generate a new hypnosis session */
router.post(
  '/sessions/generate',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGenerateSession,
);

/** Regenerate a specific paragraph of a script */
router.post(
  '/sessions/:id/regenerate-paragraph',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleRegenerateParagraph,
);

/**
 * SSE endpoint for live generation progress. Uses
 * {@link authenticateFromQuery} because the browser's `EventSource`
 * API cannot set an `Authorization` header — the frontend appends
 * `?token=...` to the URL instead.
 */
router.get(
  '/sessions/:id/events',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticateFromQuery(),
  sessionEventsHandler,
);

export const aiRoutes = router;
