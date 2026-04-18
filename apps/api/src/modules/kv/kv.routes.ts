import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleGetKv,
  handlePutKv,
  handleDeleteKv,
} from './kv.controller.js';

/**
 * Per-user key/value store for frontend client state (see
 * `kv.controller.ts` for the storage model).
 *
 * All routes require authentication and are rate-limited per-IP via
 * the same global bucket used elsewhere. The `rateLimit(...)` call is
 * inlined on each route so CodeQL's `js/missing-rate-limiting` query
 * recognises the pattern.
 */
const router = Router();

router.get(
  '/:key',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGetKv,
);

router.put(
  '/:key',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handlePutKv,
);

router.delete(
  '/:key',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleDeleteKv,
);

export const kvRouter = router;
