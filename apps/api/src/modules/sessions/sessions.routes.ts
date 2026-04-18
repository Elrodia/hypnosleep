import { Router } from 'express';
import { authenticate, authenticateFromQuery } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { requirePro } from '../../middleware/require-pro.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleList,
  handleGenerate,
  handleGetOne,
  handleGetAudio,
  handleDelete,
  handleFavorite,
  handlePlay,
  handleEditScript,
  handleRegenerate,
  handleTrending,
} from './sessions.controller.js';
import { sessionEventsHandler } from './sessions.sse.js';

const router = Router();

/**
 * Sessions module routes. Every route is rate-limited and requires
 * authentication (the SSE route uses the query-token variant because
 * `EventSource` cannot set headers).
 *
 * The `rateLimit(...)` call is inlined on every route (rather than
 * factored into a shared constant) because static analyzers — notably
 * CodeQL's `js/missing-rate-limiting` query — pattern-match on the
 * literal call expression. Hoisting it into a variable causes false-
 * positive alerts.
 *
 * Static segments such as `/trending` and `/generate` are registered
 * before parametrised `/:id` routes so they aren't shadowed.
 */

// ── Static-segment routes ────────────────────────────────────────────
router.get(
  '/trending',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleTrending,
);
router.get(
  '/',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleList,
);
router.post(
  '/generate',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGenerate,
);

// ── Parametrised routes ──────────────────────────────────────────────
router.get(
  '/:id',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGetOne,
);
router.get(
  '/:id/audio',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleGetAudio,
);
router.delete(
  '/:id',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleDelete,
);
router.post(
  '/:id/favorite',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleFavorite,
);
router.post(
  '/:id/play',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handlePlay,
);
router.put(
  '/:id/script',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  requirePro(),
  handleEditScript,
);
router.post(
  '/:id/regenerate',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleRegenerate,
);

// SSE: query-token auth so the browser's EventSource can connect.
router.get(
  '/:id/events',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticateFromQuery(),
  sessionEventsHandler,
);

export const sessionsRoutes = router;
