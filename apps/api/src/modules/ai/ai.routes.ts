import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import {
  handleGenerateSession,
  handleRegenerateParagraph,
  handleSessionEvents,
} from './ai.controller.js';

const router = Router();

/**
 * AI module routes.
 * All routes require authentication.
 */

/** Generate a new hypnosis session */
router.post(
  '/sessions/generate',
  authenticate(),
  handleGenerateSession,
);

/** Regenerate a specific paragraph of a script */
router.post(
  '/sessions/:id/regenerate-paragraph',
  authenticate(),
  handleRegenerateParagraph,
);

/** SSE endpoint for generation progress */
router.get(
  '/sessions/:id/events',
  authenticate(),
  handleSessionEvents,
);

export const aiRoutes = router;
