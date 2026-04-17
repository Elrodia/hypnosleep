import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import {
  handleListSessions,
  handleGetSession,
  handleDeleteSession,
} from './sessions.controller.js';

const router = Router();

/**
 * Sessions module routes.
 * All routes require authentication.
 */

/** List authenticated user's sessions */
router.get('/', authenticate(), handleListSessions);

/** Get a specific session */
router.get('/:id', authenticate(), handleGetSession);

/** Delete a specific session */
router.delete('/:id', authenticate(), handleDeleteSession);

export const sessionsRoutes = router;
