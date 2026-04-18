import Stripe from 'stripe';
import { env } from '../../config/env.js';

/**
 * Shared Stripe client.
 *
 * We pin `apiVersion` to the version of the Stripe TypeScript types
 * bundled with the installed SDK so that response shapes match the
 * compile-time expectations in the service and webhook handlers. The
 * cast to `Stripe.LatestApiVersion` keeps this module forward-compatible
 * with minor SDK bumps — upgrading the SDK will surface a type error
 * here if the pinned version needs to move.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  typescript: true,
});

export type { Stripe };
