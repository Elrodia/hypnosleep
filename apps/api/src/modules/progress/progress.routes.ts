import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleLogMood,
  handleStats,
  handleStreak,
  handleHeatmap,
  handleMoodTrend,
  handleWeeklyInsight,
} from './progress.controller.js';

const router = Router();

/**
 * Progress module routes.
 *
 * Every endpoint is authenticated and rate-limited. The
 * `rateLimit(...)` call is inlined on each route rather than being
 * hoisted into a shared constant because CodeQL's
 * `js/missing-rate-limiting` query pattern-matches on the literal
 * call expression — factoring it out produces false positives.
 */

router.post(
  '/mood-log',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleLogMood,
);

router.get(
  '/stats',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleStats,
);

router.get(
  '/streak',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleStreak,
);

router.get(
  '/heatmap',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleHeatmap,
);

router.get(
  '/mood-trend',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleMoodTrend,
);

router.get(
  '/weekly-insight',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleWeeklyInsight,
);

export const progressRouter = router;
