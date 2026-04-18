import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { stripe } from './stripe.client.js';
import { mysqlDb } from '../../db/mysql/client.js';
import { users } from '../../db/mysql/schema/users.js';
import { subscriptions } from '../../db/mysql/schema/subscriptions.js';
import { referrals } from '../../db/mysql/schema/referrals.js';
import { pgDb } from '../../db/postgres/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../../services/email.service.js';

/** Stripe subscription statuses we persist to MySQL as-is. */
type MirroredStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired';

const MIRRORED_STATUSES: readonly MirroredStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
] as const;

function normaliseStatus(status: Stripe.Subscription.Status): MirroredStatus {
  return (MIRRORED_STATUSES as readonly string[]).includes(status)
    ? (status as MirroredStatus)
    : 'incomplete';
}

function trackEvent(
  userId: string | undefined,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  if (!userId) return;
  pgDb
    .insert(events)
    .values({ userId, eventType, metadata: metadata ?? null })
    .catch((err) => {
      logger.warn({ err, userId, eventType }, 'Failed to record webhook event');
    });
}

/**
 * Express handler for Stripe webhook deliveries.
 *
 * SECURITY: the caller MUST mount this route with
 * `express.raw({ type: 'application/json' })` and BEFORE the JSON body
 * parser — `stripe.webhooks.constructEvent` relies on the raw request
 * bytes to verify the HMAC signature. If the JSON parser has already
 * consumed the body, verification will fail (or, worse, silently accept
 * forged payloads in older Stripe SDKs).
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') {
    logger.warn('Stripe webhook missing signature header');
    res.status(400).send('Missing Stripe-Signature header');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    // Do NOT echo the raw error message back to the caller; it leaks
    // implementation details and isn't useful to Stripe's retry loop.
    logger.error({ err }, 'Stripe webhook signature verification failed');
    res.status(400).send('Invalid signature');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event type');
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Stripe webhook handler failed');
    // 500 → Stripe will retry with exponential backoff.
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error(
      { sessionId: session.id },
      'checkout.session.completed without userId metadata',
    );
    return;
  }
  trackEvent(userId, 'checkout_completed', { stripeSessionId: session.id });
}

async function handleSubscriptionUpsert(
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) {
    logger.error(
      { subId: sub.id },
      'Subscription event missing userId metadata; cannot reconcile',
    );
    return;
  }

  const planLabel: 'monthly' | 'yearly' =
    sub.metadata?.plan === 'yearly' ? 'yearly' : 'monthly';
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const status = normaliseStatus(sub.status);

  const [existing] = await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, sub.id))
    .limit(1);

  const data = {
    userId,
    plan: planLabel,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
  } as const;

  if (existing) {
    await mysqlDb
      .update(subscriptions)
      .set(data)
      .where(eq(subscriptions.id, existing.id));
  } else {
    await mysqlDb.insert(subscriptions).values({ id: randomUUID(), ...data });
  }

  // Keep `users.plan` in lockstep with billing state so feature gating
  // (requirePro middleware) doesn't need to round-trip to the
  // subscriptions table on every request.
  const isPro = status === 'active' || status === 'trialing';
  await mysqlDb
    .update(users)
    .set({ plan: isPro ? 'pro' : 'free' })
    .where(eq(users.id, userId));

  trackEvent(
    userId,
    status === 'trialing' ? 'trial_started' : 'subscription_updated',
    { status, plan: planLabel },
  );

  // Welcome email on the first activation (trialing or active).
  if (!existing && isPro) {
    const [user] = await mysqlDb
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user) {
      sendEmail({
        to: user.email,
        subject: 'Welcome to HypnoSleep Pro 🌙',
        html: `<h1>Welcome to Pro, ${escapeHtml(user.name)}!</h1>`
          + `<p>Your 7-day free trial has started. Create unlimited custom hypnosis `
          + `sessions and unlock all 6 voices.</p>`
          + `<p><a href="${env.FRONTEND_URL}/create">Create your first Pro session →</a></p>`,
      }).catch((err) => logger.error({ err }, 'Welcome email failed'));
    }
  }
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  await mysqlDb.update(users).set({ plan: 'free' }).where(eq(users.id, userId));
  await mysqlDb
    .update(subscriptions)
    .set({ status: 'canceled', canceledAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, sub.id));

  trackEvent(userId, 'subscription_canceled');
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const [sub] = await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);
  if (!sub) return;

  // Grant the referral bonus to the referrer the first time the
  // referred user actually pays (not merely when they start a trial —
  // this prevents a free trial abuse vector where a user signs up,
  // cancels before paying, and still earns their referrer 7 days).
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, sub.userId))
    .limit(1);

  if (user?.referredBy) {
    const [ref] = await mysqlDb
      .select()
      .from(referrals)
      .where(eq(referrals.referredId, user.id))
      .limit(1);

    if (ref && !ref.rewardApplied) {
      await applyReferralReward(user.referredBy);
      await mysqlDb
        .update(referrals)
        .set({ rewardApplied: true })
        .where(eq(referrals.id, ref.id));
    }
  }

  trackEvent(sub.userId, 'payment_succeeded', {
    amountCents: invoice.amount_paid,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const [sub] = await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId))
    .limit(1);
  if (!sub) return;

  trackEvent(sub.userId, 'payment_failed');

  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, sub.userId))
    .limit(1);

  if (user) {
    sendEmail({
      to: user.email,
      subject: 'Payment issue with your HypnoSleep Pro',
      html: `<p>Hi ${escapeHtml(user.name)}, we had trouble processing your payment. `
        + `Please update your card to keep enjoying Pro features.</p>`
        + `<p><a href="${env.FRONTEND_URL}/profile/subscription">Update payment method →</a></p>`,
    }).catch((err) => logger.warn({ err }, 'Dunning email failed'));
  }
}

/**
 * Grant the referrer's 7-day reward on the Stripe side.
 *
 * Stripe only allows changing `trial_end` while the subscription is
 * still in `trialing` status, so we branch on state:
 *   - trialing  → extend the existing trial by 7 days (from the current
 *                 `trial_end`, not `now`, so we don't shorten it for a
 *                 referrer who still has trial time left).
 *   - active / past_due / anything else → Stripe rejects `trial_end`
 *                 updates; we log a warning and skip. The reward is
 *                 still recorded as an analytics event and marked
 *                 applied, so we don't retry in a loop. A follow-up
 *                 could issue a customer-balance credit here instead.
 *   - no referrer subscription yet → nothing to do; the bonus is
 *     honoured on the referrer's first checkout by
 *     {@link createCheckoutSession}.
 */
async function applyReferralReward(referrerId: string): Promise<void> {
  const [referrerSub] = await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, referrerId))
    .limit(1);

  if (referrerSub) {
    if (referrerSub.status === 'trialing') {
      const baseSec = referrerSub.trialEndsAt
        ? Math.floor(referrerSub.trialEndsAt.getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      const newTrialEnd = baseSec + 7 * 24 * 3600;
      try {
        await stripe.subscriptions.update(referrerSub.stripeSubscriptionId, {
          trial_end: newTrialEnd,
          proration_behavior: 'none',
        });
      } catch (err) {
        logger.warn(
          { err, referrerId },
          'Could not extend referrer trial; reward recorded but not applied in Stripe',
        );
      }
    } else {
      logger.info(
        { referrerId, status: referrerSub.status },
        'Referrer subscription is past trial; reward recorded but not applied in Stripe',
      );
    }
  }

  trackEvent(referrerId, 'referral_reward_applied');
}

/**
 * Stripe widened the `Invoice.subscription` field typing over time;
 * normalise it to a plain id string for our lookup.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as unknown as { subscription?: string | Stripe.Subscription | null })
    .subscription;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : raw.id;
}

/**
 * Minimal HTML escape for interpolating user-controlled strings
 * (display names) into transactional email bodies. This module is the
 * only place we template HTML, so a local helper is preferable to
 * pulling in a new dependency.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Re-export internals for unit tests without widening the public surface.
export const __test = {
  handleCheckoutCompleted,
  handleSubscriptionUpsert,
  handleSubscriptionDeleted,
  handlePaymentSucceeded,
  handlePaymentFailed,
  applyReferralReward,
  escapeHtml,
  normaliseStatus,
};
