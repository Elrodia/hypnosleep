import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * Tests for `requirePro()` — verifies it consults the authoritative
 * `users.plan` value in MySQL rather than the (potentially stale) JWT
 * `plan` claim. The bug this guards against: a freshly-upgraded Pro
 * user whose JWT was issued before checkout still has `plan: 'free'`
 * encoded; the middleware must not reject them.
 */

// ── Env stubs (must be set before importing modules under test) ──────
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

// In-memory `users` table the fake mysqlDb reads from.
const usersById = new Map<string, { plan: 'free' | 'pro' }>();
let throwOnSelect = false;

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
  return {
    ...actual,
    eq: (_col: unknown, value: unknown) => ({ _tag: 'eq', value }),
  };
});

vi.mock('../../src/db/mysql/client.js', () => ({
  mysqlDb: {
    select: () => {
      let pred: { value: unknown } | undefined;
      const obj: Record<string, unknown> = {};
      obj.from = () => obj;
      obj.where = (p: { value: unknown }) => {
        pred = p;
        return obj;
      };
      obj.limit = () => obj;
      obj.then = (
        resolve: (v: unknown[]) => unknown,
        reject?: (err: unknown) => unknown,
      ) => {
        if (throwOnSelect) {
          const err = new Error('DB outage');
          if (reject) return reject(err);
          return Promise.reject(err);
        }
        const id = pred?.value as string | undefined;
        const row = id ? usersById.get(id) : undefined;
        return Promise.resolve(row ? [row] : []).then(resolve);
      };
      return obj;
    },
  },
}));

const { requirePro } = await import('../../src/middleware/require-pro.js');

interface NextCall {
  err?: { code?: string; statusCode?: number };
}

function runMiddleware(req: Partial<Request>): Promise<NextCall> {
  return new Promise((resolve) => {
    const next: NextFunction = (err?: unknown) => {
      resolve({ err: err as NextCall['err'] });
    };
    void requirePro()(req as Request, {} as Response, next);
  });
}

describe('requirePro middleware', () => {
  beforeEach(() => {
    usersById.clear();
    throwOnSelect = false;
  });

  it('rejects unauthenticated requests with UNAUTHENTICATED', async () => {
    const result = await runMiddleware({ user: undefined as never });
    expect(result.err?.code).toBe('UNAUTHENTICATED');
  });

  it('admits a user whose DB plan is pro even when the JWT claim says free', async () => {
    // Reproduces the post-Stripe-checkout case: the JWT was issued
    // before upgrade so `user.plan === 'free'`, but the webhook has
    // already flipped `users.plan` to `'pro'` in MySQL.
    usersById.set('u1', { plan: 'pro' });

    const result = await runMiddleware({
      user: { userId: 'u1', plan: 'free' } as never,
    });

    expect(result.err).toBeUndefined();
  });

  it('rejects a user whose DB plan is free even when the JWT claim says pro', async () => {
    // Mirror case: a Pro user whose subscription lapsed should be
    // gated immediately, not until their JWT expires.
    usersById.set('u1', { plan: 'free' });

    const result = await runMiddleware({
      user: { userId: 'u1', plan: 'pro' } as never,
    });

    expect(result.err?.code).toBe('PRO_REQUIRED');
    expect(result.err?.statusCode).toBe(402);
  });

  it('rejects when the user row is missing from the DB', async () => {
    const result = await runMiddleware({
      user: { userId: 'ghost', plan: 'pro' } as never,
    });
    expect(result.err?.code).toBe('PRO_REQUIRED');
  });

  it('fails closed (PRO_REQUIRED) when the DB lookup throws', async () => {
    // Defensive: a DB outage must not silently grant Pro access.
    throwOnSelect = true;
    usersById.set('u1', { plan: 'pro' });

    const result = await runMiddleware({
      user: { userId: 'u1', plan: 'pro' } as never,
    });

    expect(result.err?.code).toBe('PRO_REQUIRED');
  });
});
