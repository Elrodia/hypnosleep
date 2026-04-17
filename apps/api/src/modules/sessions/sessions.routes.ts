import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleListSessions,
  handleGetSession,
  handleDeleteSession,
} from './sessions.controller.js';

const router = Router();

/**
 * Sessions module routes.
 * All routes require authentication and are rate-limited.
 */

/** List authenticated user's sessions */
router.get('/', rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max), authenticate(), handleListSessions);

/** Get a specific session */
router.get('/:id', rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max), authenticate(), handleGetSession);

/** Delete a specific session */
router.delete('/:id', rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max), authenticate(), handleDeleteSession);

export const sessionsRoutes = router;
