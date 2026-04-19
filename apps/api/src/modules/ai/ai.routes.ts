import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { handleRegenerateParagraph } from './ai.controller.js';

const router = Router();

/**
 * AI module routes.
 *
 * Only paragraph regeneration lives here. Session generation
 * (`POST /api/sessions/generate`) and the progress SSE stream
 * (`GET /api/sessions/:id/events`) are owned exclusively by the
 * sessions router — see `modules/sessions/sessions.routes.ts`.
 * Both routes require authentication and are rate-limited.
 */

/** Regenerate a specific paragraph of a script */
router.post(
  '/sessions/:id/regenerate-paragraph',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleRegenerateParagraph,
);

export const aiRoutes = router;
