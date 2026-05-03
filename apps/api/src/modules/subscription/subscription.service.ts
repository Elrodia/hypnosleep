import { eq } from 'drizzle-orm';
import { stripe } from './stripe.client.js';
import { mysqlDb } from '../../db/mysql/client.js';
import { users } from '../../db/mysql/schema/users.js';
import { subscriptions, type Subscription } from '../../db/mysql/schema/subscriptions.js';
import { referrals } from '../../db/mysql/schema/referrals.js';
import { pgDb } from '../../db/postgres/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { env } from '../../config/env.js';
import { AppError, notFound, validationFailed } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { CheckoutInput } from './subscription.schema.js';

/**
 * Standard free-trial window for new Pro subscribers, in days.
 * Mirrors the value configured in the Stripe Dashboard.
 */
const TRIAL_DAYS = 7;

/**
 * Bonus trial days granted when a referred user subscribes for the
 * first time. Applied once per referral row (`referrals.rewardApplied`).
 */
const REFERRAL_REWARD_DAYS = 7;

/**
 * Fire-and-forget analytics event insert.
 *
 * Event logging lives in Postgres and is best-effort — a failure to
 * record an analytics row must never break a billing flow. We swallow
 * errors after logging them so the caller can continue.
 */
/**
 * Ranking of subscription statuses when multiple rows exist for a user.
 * Lower = more "current". `subscriptions.user_id` is not unique (re-subscribes
 * create additional rows), so a user can legitimately have several rows and we
 * need a deterministic way to pick the one billing flows should target.
 */
const STATUS_RANK: Record<Subscription['status'], number> = {
  trialing: 0,
  active: 1,
  past_due: 2,
  incomplete: 3,
  incomplete_expired: 4,
  canceled: 5,
};

/**
 * Pick the user's current subscription row deterministically:
 *   1. Prefer `trialing`/`active` over `past_due`/`incomplete*`/`canceled`.
 *   2. Then newest by `currentPeriodEnd`.
 *   3. Then newest by `createdAt` as a final tiebreaker.
 *
 * Sorting happens in JS so we issue a single `.where(eq(userId, …))` query
 * and tolerate fakes/mocks that don't implement `orderBy`.
 */
export async function getCurrentSubscription(
  userId: string,
): Promise<Subscription | null> {
  const rows = (await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))) as Subscription[];
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    const aEnd = a.currentPeriodEnd ? a.currentPeriodEnd.getTime() : 0;
    const bEnd = b.currentPeriodEnd ? b.currentPeriodEnd.getTime() : 0;
    if (aEnd !== bEnd) return bEnd - aEnd;
    const aCreated = a.createdAt ? a.createdAt.getTime() : 0;
    const bCreated = b.createdAt ? b.createdAt.getTime() : 0;
    return bCreated - aCreated;
  });
  return sorted[0] ?? null;
}

function trackEvent(
  userId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  pgDb
    .insert(events)
    .values({
      userId,
      eventType,
      metadata: metadata ?? null,
    })
    .catch((err) => {
      logger.warn({ err, userId, eventType }, 'Failed to record subscription event');
    });
}

/**
 * Create a Stripe Checkout session for the given user.
 *
 * - Creates (and caches) the Stripe customer the first time a user
 *   checks out so that subsequent checkouts/portal sessions reuse it.
 * - Extends the standard 7-day trial by {@link REFERRAL_REWARD_DAYS}
 *   days when the user was referred and the referral reward has not
 *   yet been consumed. The reward is finalised in the payment webhook.
 */
export async function createCheckoutSession(
  userId: string,
  input: CheckoutInput,
): Promise<{ url: string; sessionId: string }> {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw notFound('User');
  if (user.plan === 'pro') {
    throw validationFailed('Already a Pro subscriber');
  }

  const priceId =
    input.plan === 'monthly' ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_ANNUAL;

  // Find or create a Stripe customer — one per user. We look at the user row
  // first so a customer created during an abandoned checkout is reused rather
  // than duplicated. As a fallback, also check the most recent subscription
  // row (legacy rows from before `users.stripeCustomerId` existed).
  let customerId: string | undefined = user.stripeCustomerId ?? undefined;
  if (!customerId) {
    const existingSub = await getCurrentSubscription(userId);
    if (existingSub?.stripeCustomerId) {
      customerId = existingSub.stripeCustomerId;
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
        oauthProvider: user.oauthProvider,
      },
    });
    customerId = customer.id;
  }

  // Persist the customer id on the user so an abandoned checkout (no
  // subscription webhook yet) doesn't cause a second Stripe customer to be
  // created on the next attempt. Best-effort: if the update fails we still
  // proceed with checkout rather than block the user.
  if (user.stripeCustomerId !== customerId) {
    await mysqlDb
      .update(users)
      .set({ stripeCustomerId: customerId })
      .where(eq(users.id, userId));
  }

  // Referral bonus: +7 trial days on the first checkout by a referred user.
  let trialDays = TRIAL_DAYS;
  if (user.referredBy) {
    const [ref] = await mysqlDb
      .select()
      .from(referrals)
      .where(eq(referrals.referredId, userId))
      .limit(1);
    if (ref && !ref.rewardApplied) {
      trialDays += REFERRAL_REWARD_DAYS;
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { userId: user.id, plan: input.plan },
    },
    success_url: `${env.FRONTEND_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/upgrade?canceled=true`,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto' },
    metadata: { userId: user.id, plan: input.plan },
  });

  if (!session.url) {
    // Stripe occasionally returns a session without a hosted URL if the
    // account is misconfigured (e.g. no payment methods enabled). Surface
    // that as a clear server error rather than leaking `undefined` to the
    // client.
    throw new AppError(
      'CHECKOUT_FAILED',
      'Stripe did not return a checkout URL',
      502,
    );
  }

  trackEvent(userId, 'upgrade_clicked', {
    plan: input.plan,
    trialDays,
  });

  return { url: session.url, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session so the user can manage their
 * subscription (update card, change plan, cancel) without any custom UI.
 */
export async function createPortalSession(
  userId: string,
): Promise<{ url: string }> {
  const sub = await getCurrentSubscription(userId);

  if (!sub) throw notFound('Subscription');

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.FRONTEND_URL}/profile`,
  });

  return { url: session.url };
}

/**
 * Cancel the user's Stripe subscription at the end of the current
 * billing period. Access is retained until `currentPeriodEnd`; the
 * `customer.subscription.updated` webhook reflects the change in our DB.
 */
export async function cancelSubscription(
  userId: string,
): Promise<{ ok: true; cancelAtPeriodEnd: true }> {
  const sub = await getCurrentSubscription(userId);

  if (!sub) throw notFound('Subscription');
  if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
    throw notFound('Subscription');
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  trackEvent(userId, 'subscription_cancel_requested');

  return { ok: true, cancelAtPeriodEnd: true };
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro';
  status?: string;
  billingPeriod?: 'monthly' | 'yearly';
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  canceledAt?: Date | null;
}

/**
 * Read the user's current billing state from the local mirror. Falls
 * back to `{ plan: 'free' }` when no subscription row exists.
 */
export async function getStatus(userId: string): Promise<SubscriptionStatus> {
  const sub = await getCurrentSubscription(userId);

  // Stripe is the source of truth when a subscription row exists
  // (i.e. the user has gone through real checkout and the webhook
  // has flipped their plan).
  if (sub) {
    const isPro = sub.status === 'active' || sub.status === 'trialing';
    return {
      plan: isPro ? 'pro' : 'free',
      status: sub.status,
      billingPeriod: sub.plan,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      canceledAt: sub.canceledAt,
    };
  }

  // No Stripe subscription — fall back to the users.plan column.
  // This path covers: (a) dev/test scenarios where plan is flipped
  // by hand in MySQL, (b) future admin-grant flows that don't go
  // through Stripe, (c) lifetime-comp accounts.
  const userRows = await mysqlDb
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const plan = userRows[0]?.plan ?? 'free';

  return { plan };
}
