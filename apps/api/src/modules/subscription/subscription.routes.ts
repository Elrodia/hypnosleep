import { Router, raw } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import {
  handleCancel,
  handleCheckout,
  handlePortal,
  handleStatus,
} from './subscription.controller.js';
import { stripeWebhookHandler } from './subscription.webhook.js';

const router = Router();

/**
 * Subscription module routes.
 *
 * Mounting order matters: the webhook endpoint is registered FIRST and
 * with `express.raw({ type: 'application/json' })` so that Stripe's
 * signature verification can see the exact bytes it signed. All other
 * routes require a JWT via `authenticate()` and are rate-limited.
 *
 * The `rateLimit(...)` call is inlined on every route (rather than
 * factored into a shared variable) to keep CodeQL's
 * `js/missing-rate-limiting` query happy — it pattern-matches on the
 * literal call expression.
 */

// Webhook — no auth (signature-verified), raw body, high-ish rate limit
// so Stripe retries aren't starved. Stripe itself caps delivery rate.
router.post(
  '/webhook',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  raw({ type: 'application/json', limit: '1mb' }),
  stripeWebhookHandler,
);

router.get(
  '/status',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleStatus,
);

router.post(
  '/checkout',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleCheckout,
);

router.post(
  '/portal',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handlePortal,
);

router.post(
  '/cancel',
  rateLimit(RATE_LIMITS.API_GLOBAL.window, RATE_LIMITS.API_GLOBAL.max),
  authenticate(),
  handleCancel,
);

export const subscriptionRouter = router;
