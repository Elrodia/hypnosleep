import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleGetProfile,
  handleUpdateProfile,
  handleReferralStats,
  handleExportData,
  handleDeleteAccount,
} from './profile.controller.js';

const router = Router();

/**
 * Profile module routes.
 *
 * All endpoints require authentication and are rate-limited. The
 * literal `rateLimit(...)` call is inlined on each route so CodeQL's
 * `js/missing-rate-limiting` query recognises the pattern — see the
 * sessions router for the same convention.
 *
 * The static `/referral` and `/export` segments are registered
 * before the root `/` handlers to avoid accidental shadowing under
 * any future parametrised routes.
 */

router.get(
  '/referral',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleReferralStats,
);

router.get(
  '/export',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleExportData,
);

router.get(
  '/',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGetProfile,
);

router.patch(
  '/',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleUpdateProfile,
);

router.delete(
  '/',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleDeleteAccount,
);

export const profileRouter = router;
