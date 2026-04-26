import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleList,
  handleMarkRead,
  handleMarkAllRead,
} from './notifications.controller.js';

/**
 * Per-user notifications inbox routes. The `rateLimit(...)` call is
 * inlined on each route so CodeQL's `js/missing-rate-limiting` query
 * recognises the pattern (matching the convention used by the other
 * routers in this codebase).
 *
 * Static segments (`/read-all`) are registered before parametrised
 * `/:id/read` so they can't be shadowed.
 */
const router = Router();

router.get(
  '/',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleList,
);

router.post(
  '/read-all',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleMarkAllRead,
);

router.post(
  '/:id/read',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleMarkRead,
);

export const notificationsRouter = router;
