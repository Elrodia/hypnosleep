import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Subscription module unit tests.
 *
 * Follows the same pattern as the sessions tests: external boundaries
 * (MySQL/Postgres Drizzle clients, Stripe SDK, email transport) are
 * replaced with in-memory fakes so the service and webhook logic can
 * be exercised deterministically without touching real infra.
 */

// ── Env: set before the service modules import `../../config/env` ──────
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test/test';
process.env.MYSQL_URL = 'mysql://test/test';
process.env.JWT_SECRET = 'test-secret';
process.env.GEMINI_API_KEY = 'test-gemini';
process.env.GOOGLE_CLIENT_ID = 'x';
process.env.GOOGLE_CLIENT_SECRET = 'x';
process.env.GITHUB_CLIENT_ID = 'x';
process.env.GITHUB_CLIENT_SECRET = 'x';
process.env.MICROSOFT_CLIENT_ID = 'x';
process.env.MICROSOFT_CLIENT_SECRET = 'x';
process.env.S3_ACCESS_KEY = 'x';
process.env.S3_SECRET_KEY = 'x';
process.env.S3_BUCKET = 'x';
process.env.S3_ENDPOINT = 'https://s3.test';
process.env.S3_REGION = 'auto';
process.env.STRIPE_SECRET_KEY = 'sk_test_x';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_x';
process.env.STRIPE_PRICE_ANNUAL = 'price_annual_x';
process.env.FRONTEND_URL = 'https://app.test';

// ── Stateful in-memory fakes ──────────────────────────────────────────
type Plan = 'free' | 'pro';
interface UserRow {
  id: string;
  email: string;
  name: string;
  oauthProvider: 'google' | 'github' | 'microsoft';
  plan: Plan;
  referredBy: string | null;
}
interface SubscriptionRow {
  id: string;
  userId: string;
  plan: 'monthly' | 'yearly';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
}
interface ReferralRow {
  id: string;
  referrerId: string;
  referredId: string;
  rewardApplied: boolean;
}
interface EventRow {
  userId: string | null;
  eventType: string;
  metadata: unknown;
}

const state = {
  users: new Map<string, UserRow>(),
  subscriptions: new Map<string, SubscriptionRow>(),
  referrals: new Map<string, ReferralRow>(),
  events: [] as EventRow[],
  stripeCustomersCreated: [] as Array<Record<string, unknown>>,
  stripeCheckoutsCreated: [] as Array<Record<string, unknown>>,
  stripeSubscriptionsUpdated: [] as Array<{ id: string; params: Record<string, unknown> }>,
  stripePortalSessionsCreated: [] as Array<Record<string, unknown>>,
  emailsSent: [] as Array<{ to: string; subject: string; html: string }>,
};

function resetState(): void {
  state.users.clear();
  state.subscriptions.clear();
  state.referrals.clear();
  state.events.length = 0;
  state.stripeCustomersCreated.length = 0;
  state.stripeCheckoutsCreated.length = 0;
  state.stripeSubscriptionsUpdated.length = 0;
  state.stripePortalSessionsCreated.length = 0;
  state.emailsSent.length = 0;
}

// ── Tag-based where-predicate helpers, mirroring sessions.test.ts ─────
interface Pred {
  _tag: 'eq';
  field: string;
  value: unknown;
}

function evalPred(pred: Pred | undefined, row: Record<string, unknown>): boolean {
  if (!pred) return true;
  // Drizzle stores the SQL column name (snake_case) on the column's
  // `.name`; our fake state rows use JS camelCase field names, so we
  // translate before comparing.
  const sqlToJs: Record<string, string> = {
    id: 'id',
    user_id: 'userId',
    referred_id: 'referredId',
    referrer_id: 'referrerId',
    stripe_subscription_id: 'stripeSubscriptionId',
    stripe_customer_id: 'stripeCustomerId',
  };
  const field = sqlToJs[pred.field] ?? pred.field;
  return row[field] === pred.value;
}

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
  return {
    ...actual,
    eq: (col: { name?: string } | string, value: unknown): Pred => {
      const field =
        typeof col === 'string'
          ? col
          : (col as { name?: string }).name ?? 'unknown';
      return { _tag: 'eq', field, value };
    },
  };
});

// ── Drizzle MySQL client fake ─────────────────────────────────────────
function columnName(colOrSym: unknown): string {
  const col = colOrSym as { name?: string } | undefined;
  return col?.name ?? 'unknown';
}

function tableName(sym: unknown): string {
  if (!sym || typeof sym !== 'object') return 'unknown';
  const syms = Object.getOwnPropertySymbols(sym);
  const nameSym = syms.find((s) => s.toString() === 'Symbol(drizzle:Name)');
  if (nameSym) {
    const name = (sym as Record<symbol, unknown>)[nameSym];
    if (typeof name === 'string') return name;
  }
  return 'unknown';
}

function tableRows(tbl: string): Record<string, unknown>[] {
  switch (tbl) {
    case 'users':
      return Array.from(state.users.values()) as unknown as Record<string, unknown>[];
    case 'subscriptions':
      return Array.from(state.subscriptions.values()) as unknown as Record<string, unknown>[];
    case 'referrals':
      return Array.from(state.referrals.values()) as unknown as Record<string, unknown>[];
    default:
      return [];
  }
}

function makeMysqlFake() {
  const select = () => {
    let tbl: string | null = null;
    let pred: Pred | undefined;
    let limited = Number.POSITIVE_INFINITY;
    const obj: Record<string, unknown> = {};
    obj.from = (sym: unknown) => {
      tbl = tableName(sym);
      return obj;
    };
    obj.where = (p: Pred) => {
      pred = p;
      return obj;
    };
    obj.limit = (n: number) => {
      limited = n;
      return obj;
    };
    obj.then = (resolve: (v: unknown[]) => unknown) => {
      const all = tbl ? tableRows(tbl) : [];
      const filtered = all.filter((r) => evalPred(pred, r));
      const out = Number.isFinite(limited) ? filtered.slice(0, limited) : filtered;
      return Promise.resolve(out).then(resolve);
    };
    return obj;
  };

  const insert = (sym: unknown) => {
    const tbl = tableName(sym);
    return {
      values: (v: Record<string, unknown>) => ({
        then: (r: (v: unknown) => unknown) => {
          if (tbl === 'subscriptions') {
            state.subscriptions.set(v.id as string, v as unknown as SubscriptionRow);
          } else if (tbl === 'referrals') {
            state.referrals.set(v.id as string, v as unknown as ReferralRow);
          } else if (tbl === 'users') {
            state.users.set(v.id as string, v as unknown as UserRow);
          }
          return Promise.resolve(undefined).then(r);
        },
      }),
    };
  };

  const update = (sym: unknown) => {
    const tbl = tableName(sym);
    return {
      set: (patch: Record<string, unknown>) => ({
        where: (p: Pred) => ({
          then: (r: (v: unknown) => unknown) => {
            const target =
              tbl === 'users'
                ? state.users
                : tbl === 'subscriptions'
                  ? state.subscriptions
                  : tbl === 'referrals'
                    ? state.referrals
                    : null;
            if (target) {
              for (const row of target.values()) {
                if (evalPred(p, row as unknown as Record<string, unknown>)) {
                  Object.assign(row as object, patch);
                }
              }
            }
            return Promise.resolve(undefined).then(r);
          },
        }),
      }),
    };
  };

  return {
    mysqlDb: {
      select: () => select(),
      insert,
      update,
    },
  };
}

vi.mock('../../../src/db/mysql/client.js', () => makeMysqlFake());

// ── Postgres client fake (analytics events) ───────────────────────────
vi.mock('../../../src/db/postgres/client.js', () => ({
  pgDb: {
    insert: (_sym: unknown) => ({
      values: (v: Record<string, unknown>) => {
        state.events.push({
          userId: (v.userId as string | null) ?? null,
          eventType: v.eventType as string,
          metadata: v.metadata,
        });
        return {
          catch: (_fn: unknown) => Promise.resolve(),
          then: (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r),
        };
      },
    }),
  },
}));

// ── Stripe SDK fake ───────────────────────────────────────────────────
const stripeFake = {
  customers: {
    create: vi.fn(async (params: Record<string, unknown>) => {
      state.stripeCustomersCreated.push(params);
      return { id: `cus_${state.stripeCustomersCreated.length}` };
    }),
  },
  checkout: {
    sessions: {
      create: vi.fn(async (params: Record<string, unknown>) => {
        state.stripeCheckoutsCreated.push(params);
        return {
          id: `cs_${state.stripeCheckoutsCreated.length}`,
          url: `https://checkout.stripe.com/c/${state.stripeCheckoutsCreated.length}`,
        };
      }),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(async (params: Record<string, unknown>) => {
        state.stripePortalSessionsCreated.push(params);
        return { url: 'https://billing.stripe.com/p/test' };
      }),
    },
  },
  subscriptions: {
    update: vi.fn(async (id: string, params: Record<string, unknown>) => {
      state.stripeSubscriptionsUpdated.push({ id, params });
      return { id, ...params };
    }),
  },
  webhooks: {
    constructEvent: vi.fn((_body: unknown, sig: string) => {
      if (sig !== 'valid-sig') {
        throw new Error('Invalid signature');
      }
      return JSON.parse((_body as Buffer).toString('utf8'));
    }),
  },
};

vi.mock('../../../src/modules/subscription/stripe.client.js', () => ({
  stripe: stripeFake,
}));

// ── Email service fake ────────────────────────────────────────────────
vi.mock('../../../src/services/email.service.js', () => ({
  sendEmail: vi.fn(async (input: { to: string; subject: string; html: string }) => {
    state.emailsSent.push(input);
    return { transport: 'test' };
  }),
}));

// ── Imports under test (after all mocks) ───────────────────────────────
const {
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  getStatus,
} = await import('../../../src/modules/subscription/subscription.service.js');
const { stripeWebhookHandler, __test } = await import(
  '../../../src/modules/subscription/subscription.webhook.js'
);

// ── Helpers ───────────────────────────────────────────────────────────
function seedUser(overrides: Partial<UserRow> = {}): UserRow {
  const user: UserRow = {
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'alice@example.com',
    name: overrides.name ?? 'Alice',
    oauthProvider: overrides.oauthProvider ?? 'google',
    plan: overrides.plan ?? 'free',
    referredBy: overrides.referredBy ?? null,
  };
  state.users.set(user.id, user);
  return user;
}

function makeSubscriptionEvent(
  status: string,
  overrides: Partial<{
    id: string;
    userId: string;
    plan: 'monthly' | 'yearly';
    trialEnd: number | null;
    canceledAt: number | null;
  }> = {},
): { body: Buffer; parsed: unknown } {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: 'evt_1',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: overrides.id ?? 'sub_1',
        customer: 'cus_1',
        status,
        trial_end: overrides.trialEnd === undefined ? null : overrides.trialEnd,
        current_period_end: now + 30 * 24 * 3600,
        canceled_at: overrides.canceledAt ?? null,
        metadata: {
          userId: overrides.userId ?? 'user-1',
          plan: overrides.plan ?? 'monthly',
        },
      },
    },
  };
  return { body: Buffer.from(JSON.stringify(payload)), parsed: payload };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────
describe('subscription.service', () => {
  beforeEach(() => {
    resetState();
    stripeFake.customers.create.mockClear();
    stripeFake.checkout.sessions.create.mockClear();
    stripeFake.subscriptions.update.mockClear();
  });

  describe('createCheckoutSession', () => {
    it('throws NOT_FOUND for unknown user', async () => {
      await expect(
        createCheckoutSession('ghost', { plan: 'monthly' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('blocks users that are already Pro', async () => {
      seedUser({ plan: 'pro' });
      await expect(
        createCheckoutSession('user-1', { plan: 'monthly' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('creates a new Stripe customer on first checkout and applies standard 7-day trial', async () => {
      seedUser();
      const result = await createCheckoutSession('user-1', { plan: 'monthly' });

      expect(result.url).toMatch(/checkout\.stripe\.com/);
      expect(stripeFake.customers.create).toHaveBeenCalledTimes(1);
      expect(stripeFake.checkout.sessions.create).toHaveBeenCalledTimes(1);

      const params = state.stripeCheckoutsCreated[0] as {
        mode: string;
        line_items: Array<{ price: string }>;
        subscription_data: { trial_period_days: number; metadata: Record<string, string> };
        metadata: Record<string, string>;
      };
      expect(params.mode).toBe('subscription');
      expect(params.line_items[0].price).toBe('price_monthly_x');
      expect(params.subscription_data.trial_period_days).toBe(7);
      expect(params.metadata.userId).toBe('user-1');
      // Analytics event logged
      expect(state.events.some((e) => e.eventType === 'upgrade_clicked')).toBe(true);
    });

    it('uses the annual price id for plan=yearly', async () => {
      seedUser();
      await createCheckoutSession('user-1', { plan: 'yearly' });
      const params = state.stripeCheckoutsCreated[0] as {
        line_items: Array<{ price: string }>;
      };
      expect(params.line_items[0].price).toBe('price_annual_x');
    });

    it('adds +7 trial days when the user was referred and the reward has not been applied', async () => {
      seedUser({ id: 'referrer', referredBy: null });
      seedUser({ id: 'user-1', referredBy: 'referrer' });
      state.referrals.set('ref-1', {
        id: 'ref-1',
        referrerId: 'referrer',
        referredId: 'user-1',
        rewardApplied: false,
      });

      await createCheckoutSession('user-1', { plan: 'monthly' });
      const params = state.stripeCheckoutsCreated[0] as {
        subscription_data: { trial_period_days: number };
      };
      expect(params.subscription_data.trial_period_days).toBe(14);
    });

    it('does NOT add bonus days when the referral reward has already been applied', async () => {
      seedUser({ id: 'referrer' });
      seedUser({ id: 'user-1', referredBy: 'referrer' });
      state.referrals.set('ref-1', {
        id: 'ref-1',
        referrerId: 'referrer',
        referredId: 'user-1',
        rewardApplied: true,
      });

      await createCheckoutSession('user-1', { plan: 'monthly' });
      const params = state.stripeCheckoutsCreated[0] as {
        subscription_data: { trial_period_days: number };
      };
      expect(params.subscription_data.trial_period_days).toBe(7);
    });

    it('reuses an existing Stripe customer id', async () => {
      seedUser();
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_existing',
        stripeSubscriptionId: 'sub_old',
        status: 'canceled',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: new Date(),
      });

      await createCheckoutSession('user-1', { plan: 'monthly' });
      expect(stripeFake.customers.create).not.toHaveBeenCalled();
      const params = state.stripeCheckoutsCreated[0] as { customer: string };
      expect(params.customer).toBe('cus_existing');
    });
  });

  describe('createPortalSession', () => {
    it('throws NOT_FOUND when the user has no subscription', async () => {
      seedUser();
      await expect(createPortalSession('user-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns a billing portal URL', async () => {
      seedUser();
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      const result = await createPortalSession('user-1');
      expect(result.url).toMatch(/billing\.stripe\.com/);
    });
  });

  describe('cancelSubscription', () => {
    it('sets cancel_at_period_end on the Stripe subscription', async () => {
      seedUser({ plan: 'pro' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      const result = await cancelSubscription('user-1');
      expect(result).toEqual({ ok: true, cancelAtPeriodEnd: true });
      expect(stripeFake.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
      });
      expect(state.events.some((e) => e.eventType === 'subscription_cancel_requested')).toBe(true);
    });

    it('throws NOT_FOUND without a subscription', async () => {
      seedUser();
      await expect(cancelSubscription('user-1')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getStatus', () => {
    it('returns free when no subscription exists', async () => {
      seedUser();
      await expect(getStatus('user-1')).resolves.toEqual({ plan: 'free' });
    });

    it('returns pro for active/trialing statuses, free otherwise', async () => {
      seedUser();
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        canceledAt: null,
      });
      const trialing = await getStatus('user-1');
      expect(trialing.plan).toBe('pro');
      expect(trialing.status).toBe('trialing');
      expect(trialing.billingPeriod).toBe('monthly');

      const sub = state.subscriptions.get('s1')!;
      sub.status = 'past_due';
      const pastDue = await getStatus('user-1');
      expect(pastDue.plan).toBe('free');
      expect(pastDue.status).toBe('past_due');
    });
  });
});

describe('subscription.webhook', () => {
  beforeEach(() => {
    resetState();
    stripeFake.webhooks.constructEvent.mockClear();
    stripeFake.subscriptions.update.mockClear();
  });

  it('rejects requests with a missing signature header (400)', async () => {
    const req = { headers: {}, body: Buffer.from('{}') } as unknown as Parameters<typeof stripeWebhookHandler>[0];
    const res = mockRes();
    await stripeWebhookHandler(req, res as unknown as Parameters<typeof stripeWebhookHandler>[1]);
    expect(res.statusCode).toBe(400);
  });

  it('rejects requests with an invalid signature (400) and does not run handlers', async () => {
    const { body } = makeSubscriptionEvent('active');
    const req = {
      headers: { 'stripe-signature': 'bad-sig' },
      body,
    } as unknown as Parameters<typeof stripeWebhookHandler>[0];
    const res = mockRes();
    await stripeWebhookHandler(req, res as unknown as Parameters<typeof stripeWebhookHandler>[1]);
    expect(res.statusCode).toBe(400);
    expect(state.events).toHaveLength(0);
  });

  it('accepts a valid signature and returns { received: true }', async () => {
    seedUser();
    const { body } = makeSubscriptionEvent('trialing');
    const req = {
      headers: { 'stripe-signature': 'valid-sig' },
      body,
    } as unknown as Parameters<typeof stripeWebhookHandler>[0];
    const res = mockRes();
    await stripeWebhookHandler(req, res as unknown as Parameters<typeof stripeWebhookHandler>[1]);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  describe('handleSubscriptionUpsert', () => {
    it('inserts a new subscription row and marks the user as pro on trialing', async () => {
      seedUser();
      await __test.handleSubscriptionUpsert({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        canceled_at: null,
        metadata: { userId: 'user-1', plan: 'monthly' },
      } as never);

      const subs = Array.from(state.subscriptions.values());
      expect(subs).toHaveLength(1);
      expect(subs[0]).toMatchObject({
        userId: 'user-1',
        plan: 'monthly',
        stripeSubscriptionId: 'sub_1',
        status: 'trialing',
      });
      expect(state.users.get('user-1')?.plan).toBe('pro');
      expect(state.events.some((e) => e.eventType === 'trial_started')).toBe(true);
      // Welcome email sent on first activation
      expect(state.emailsSent).toHaveLength(1);
      expect(state.emailsSent[0].subject).toMatch(/Welcome/);
    });

    it('updates an existing subscription and does not resend the welcome email', async () => {
      seedUser({ plan: 'pro' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'trialing',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });

      await __test.handleSubscriptionUpsert({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        trial_end: null,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        canceled_at: null,
        metadata: { userId: 'user-1', plan: 'monthly' },
      } as never);

      expect(Array.from(state.subscriptions.values())).toHaveLength(1);
      expect(state.subscriptions.get('s1')?.status).toBe('active');
      expect(state.emailsSent).toHaveLength(0);
    });

    it('downgrades the user to free when the status becomes past_due', async () => {
      seedUser({ plan: 'pro' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });

      await __test.handleSubscriptionUpsert({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'past_due',
        trial_end: null,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        canceled_at: null,
        metadata: { userId: 'user-1', plan: 'monthly' },
      } as never);

      expect(state.users.get('user-1')?.plan).toBe('free');
    });

    it('ignores subscriptions without a userId metadata field', async () => {
      await __test.handleSubscriptionUpsert({
        id: 'sub_ghost',
        customer: 'cus_1',
        status: 'active',
        trial_end: null,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
        canceled_at: null,
        metadata: {},
      } as never);
      expect(state.subscriptions.size).toBe(0);
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('downgrades the user and marks the subscription canceled', async () => {
      seedUser({ plan: 'pro' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });

      await __test.handleSubscriptionDeleted({
        id: 'sub_1',
        metadata: { userId: 'user-1' },
      } as never);

      expect(state.users.get('user-1')?.plan).toBe('free');
      expect(state.subscriptions.get('s1')?.status).toBe('canceled');
      expect(state.subscriptions.get('s1')?.canceledAt).toBeInstanceOf(Date);
      expect(state.events.some((e) => e.eventType === 'subscription_canceled')).toBe(true);
    });
  });

  describe('handlePaymentSucceeded', () => {
    it('applies the referral reward on the first successful payment and marks it consumed', async () => {
      seedUser({ id: 'referrer' });
      seedUser({ id: 'user-1', referredBy: 'referrer' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      // Referrer is still trialing, so Stripe trial_end extension is safe.
      const referrerTrialEnd = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      state.subscriptions.set('s2', {
        id: 's2',
        userId: 'referrer',
        plan: 'monthly',
        stripeCustomerId: 'cus_2',
        stripeSubscriptionId: 'sub_2',
        status: 'trialing',
        trialEndsAt: referrerTrialEnd,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      state.referrals.set('r1', {
        id: 'r1',
        referrerId: 'referrer',
        referredId: 'user-1',
        rewardApplied: false,
      });

      await __test.handlePaymentSucceeded({
        subscription: 'sub_1',
        amount_paid: 1999,
      } as never);

      expect(state.referrals.get('r1')?.rewardApplied).toBe(true);
      expect(stripeFake.subscriptions.update).toHaveBeenCalledWith(
        'sub_2',
        expect.objectContaining({ proration_behavior: 'none' }),
      );
      // trial_end should be extended from the existing trial end, not `now`.
      const updateCall = state.stripeSubscriptionsUpdated[0];
      const expectedTrialEnd =
        Math.floor(referrerTrialEnd.getTime() / 1000) + 7 * 24 * 3600;
      expect((updateCall.params as { trial_end: number }).trial_end).toBe(expectedTrialEnd);
      expect(state.events.some((e) => e.eventType === 'referral_reward_applied')).toBe(true);
      expect(state.events.some((e) => e.eventType === 'payment_succeeded')).toBe(true);
    });

    it('skips the Stripe trial extension when the referrer is already on an active subscription', async () => {
      seedUser({ id: 'referrer' });
      seedUser({ id: 'user-1', referredBy: 'referrer' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      state.subscriptions.set('s2', {
        id: 's2',
        userId: 'referrer',
        plan: 'monthly',
        stripeCustomerId: 'cus_2',
        stripeSubscriptionId: 'sub_2',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      state.referrals.set('r1', {
        id: 'r1',
        referrerId: 'referrer',
        referredId: 'user-1',
        rewardApplied: false,
      });

      await __test.handlePaymentSucceeded({
        subscription: 'sub_1',
        amount_paid: 1999,
      } as never);

      // Reward still marked applied (no retry loop) and analytics event
      // still fired, but we do NOT hit Stripe with a doomed update.
      expect(state.referrals.get('r1')?.rewardApplied).toBe(true);
      expect(state.events.some((e) => e.eventType === 'referral_reward_applied')).toBe(true);
      expect(stripeFake.subscriptions.update).not.toHaveBeenCalled();
    });

    it('does nothing when the reward has already been applied', async () => {
      seedUser({ id: 'referrer' });
      seedUser({ id: 'user-1', referredBy: 'referrer' });
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });
      state.referrals.set('r1', {
        id: 'r1',
        referrerId: 'referrer',
        referredId: 'user-1',
        rewardApplied: true,
      });

      await __test.handlePaymentSucceeded({
        subscription: 'sub_1',
        amount_paid: 1999,
      } as never);

      expect(stripeFake.subscriptions.update).not.toHaveBeenCalled();
    });
  });

  describe('handlePaymentFailed', () => {
    it('sends a dunning email and records the event', async () => {
      seedUser();
      state.subscriptions.set('s1', {
        id: 's1',
        userId: 'user-1',
        plan: 'monthly',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        status: 'past_due',
        trialEndsAt: null,
        currentPeriodEnd: new Date(),
        canceledAt: null,
      });

      await __test.handlePaymentFailed({
        subscription: 'sub_1',
      } as never);

      expect(state.events.some((e) => e.eventType === 'payment_failed')).toBe(true);
      expect(state.emailsSent).toHaveLength(1);
      expect(state.emailsSent[0].subject).toMatch(/Payment issue/);
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML-unsafe characters in user-controlled strings', () => {
      expect(__test.escapeHtml('<script>alert("x")</script>')).toBe(
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
      );
      expect(__test.escapeHtml("O'Hara & Sons")).toBe('O&#39;Hara &amp; Sons');
    });
  });
});
