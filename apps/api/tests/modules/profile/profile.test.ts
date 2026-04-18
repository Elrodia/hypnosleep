import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Profile service unit tests.
 *
 * The service touches MySQL (users/sessions/subscriptions/favorites/
 * referrals), Postgres (events/moods/ai-generations/streaks/insights),
 * the Stripe API, and S3 — none of which are available here. We
 * replace each with a stateful in-memory fake so we can assert that
 * `updateProfile` merges preferences correctly, that the GDPR export
 * returns everything we hold, and that `deleteAccount` cleans up the
 * right rows and S3 keys in the right order.
 */

// ── State ────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  preferences: Record<string, unknown> | null;
  referralCode: string;
  referredBy: string | null;
}
interface SubscriptionRow {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  status: string;
}
interface ReferralRow {
  id: string;
  referrerId: string;
  referredId: string;
  rewardApplied: boolean;
}
interface SessionRow {
  id: string;
  userId: string;
}

const state = {
  users: new Map<string, UserRow>(),
  sessions: new Map<string, SessionRow>(),
  subscriptions: [] as SubscriptionRow[],
  favorites: [] as Array<{ userId: string; sessionId: string }>,
  referrals: [] as ReferralRow[],
  events: [] as Array<{ userId: string; eventType: string }>,
  moodLogs: [] as Array<{ userId: string; rating: number }>,
  aiGenerations: [] as Array<{ userId: string }>,
  streaks: new Map<string, { userId: string; currentStreak: number }>(),
  weeklyInsights: [] as Array<{ userId: string; insightText: string }>,
  stripeCanceled: [] as string[],
  stripeShouldThrow: false,
  s3Deleted: [] as string[],
  /** MySQL update/delete records so tests can inspect side-effects. */
  mysqlDeletes: [] as Array<{ table: string; filter: unknown }>,
};

// ── Drizzle predicates ───────────────────────────────────────────────
type Pred =
  | { op: 'eq'; field: string; value: unknown }
  | { op: 'or'; children: Pred[] }
  | { op: 'and'; children: Pred[] };

function evalPred(p: Pred | undefined, row: Record<string, unknown>): boolean {
  if (!p) return true;
  if (p.op === 'eq') return row[p.field] === p.value;
  if (p.op === 'or') return p.children.some((c) => evalPred(c, row));
  if (p.op === 'and') return p.children.every((c) => evalPred(c, row));
  return true;
}

// ── MySQL fake ───────────────────────────────────────────────────────
function mysqlTableRows(name: string): Record<string, unknown>[] {
  if (name === 'users')
    return Array.from(state.users.values()) as unknown as Record<string, unknown>[];
  if (name === 'sessions')
    return Array.from(state.sessions.values()) as unknown as Record<string, unknown>[];
  if (name === 'subscriptions')
    return state.subscriptions as unknown as Record<string, unknown>[];
  if (name === 'favorites')
    return state.favorites as unknown as Record<string, unknown>[];
  if (name === 'referrals')
    return state.referrals as unknown as Record<string, unknown>[];
  return [];
}

function deleteFromMysql(name: string, pred: Pred | undefined): void {
  if (name === 'referrals') {
    state.referrals = state.referrals.filter(
      (r) => !evalPred(pred, r as unknown as Record<string, unknown>),
    );
  } else if (name === 'users') {
    for (const [k, v] of state.users) {
      if (evalPred(pred, v as unknown as Record<string, unknown>)) {
        state.users.delete(k);
        // Simulate MySQL ON DELETE CASCADE for sessions, subscriptions,
        // favorites (usage_counters is irrelevant to these tests).
        for (const [sk, s] of state.sessions) {
          if (s.userId === k) state.sessions.delete(sk);
        }
        state.subscriptions = state.subscriptions.filter(
          (s) => s.userId !== k,
        );
        state.favorites = state.favorites.filter((f) => f.userId !== k);
      }
    }
  }
}

vi.mock('@/db/mysql/client', () => ({
  mysqlDb: {
    select: (fields?: Record<string, unknown>) => {
      let tbl: string | null = null;
      let pred: Pred | undefined;
      const chain: Record<string, unknown> = {};
      chain.from = (t: { __name: string }) => {
        tbl = t.__name;
        return chain;
      };
      chain.where = (p: Pred) => {
        pred = p;
        return chain;
      };
      chain.limit = () => chain;
      chain.then = (resolve: (rows: unknown[]) => unknown) => {
        const rows = mysqlTableRows(tbl ?? '').filter((r) => evalPred(pred, r));
        if (fields && ('totalInvited' in fields || 'rewardedCount' in fields)) {
          const totalInvited = rows.length;
          const rewardedCount = rows.filter(
            (r) => r.rewardApplied === true,
          ).length;
          return resolve([{ totalInvited, rewardedCount }]);
        }
        if (fields && 'id' in fields && Object.keys(fields).length === 1) {
          return resolve(rows.map((r) => ({ id: r.id })));
        }
        return resolve(rows);
      };
      return chain;
    },
    update: (t: { __name: string }) => {
      let vals: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {};
      chain.set = (v: Record<string, unknown>) => {
        vals = v;
        return chain;
      };
      chain.where = (p: Pred) => {
        const rows = mysqlTableRows(t.__name);
        for (const r of rows) {
          if (evalPred(p, r)) Object.assign(r, vals);
        }
        return Promise.resolve();
      };
      return chain;
    },
    delete: (t: { __name: string }) => ({
      where: (p: Pred) => {
        state.mysqlDeletes.push({ table: t.__name, filter: p });
        deleteFromMysql(t.__name, p);
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock('@/db/mysql/schema/users', () => ({
  users: {
    __name: 'users',
    id: { __field: 'id' },
    referredBy: { __field: 'referredBy' },
  },
}));
vi.mock('@/db/mysql/schema/sessions', () => ({
  sessions: {
    __name: 'sessions',
    id: { __field: 'id' },
    userId: { __field: 'userId' },
  },
}));
vi.mock('@/db/mysql/schema/subscriptions', () => ({
  subscriptions: {
    __name: 'subscriptions',
    userId: { __field: 'userId' },
  },
}));
vi.mock('@/db/mysql/schema/favorites', () => ({
  favorites: {
    __name: 'favorites',
    userId: { __field: 'userId' },
  },
}));
vi.mock('@/db/mysql/schema/referrals', () => ({
  referrals: {
    __name: 'referrals',
    referrerId: { __field: 'referrerId' },
    referredId: { __field: 'referredId' },
    rewardApplied: { __field: 'rewardApplied' },
  },
}));

// ── Postgres fake ────────────────────────────────────────────────────
function pgRows(name: string): Record<string, unknown>[] {
  if (name === 'events') return state.events as unknown as Record<string, unknown>[];
  if (name === 'mood_logs')
    return state.moodLogs as unknown as Record<string, unknown>[];
  if (name === 'ai_generations')
    return state.aiGenerations as unknown as Record<string, unknown>[];
  if (name === 'streaks')
    return Array.from(state.streaks.values()) as unknown as Record<string, unknown>[];
  if (name === 'weekly_insights')
    return state.weeklyInsights as unknown as Record<string, unknown>[];
  return [];
}

function deleteFromPg(name: string, pred: Pred | undefined): void {
  if (name === 'events') {
    state.events = state.events.filter(
      (r) => !evalPred(pred, r as unknown as Record<string, unknown>),
    );
  } else if (name === 'mood_logs') {
    state.moodLogs = state.moodLogs.filter(
      (r) => !evalPred(pred, r as unknown as Record<string, unknown>),
    );
  } else if (name === 'ai_generations') {
    state.aiGenerations = state.aiGenerations.filter(
      (r) => !evalPred(pred, r as unknown as Record<string, unknown>),
    );
  } else if (name === 'streaks') {
    for (const [k, v] of state.streaks) {
      if (evalPred(pred, v as unknown as Record<string, unknown>))
        state.streaks.delete(k);
    }
  } else if (name === 'weekly_insights') {
    state.weeklyInsights = state.weeklyInsights.filter(
      (r) => !evalPred(pred, r as unknown as Record<string, unknown>),
    );
  }
}

vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    select: () => {
      let tbl: string | null = null;
      let pred: Pred | undefined;
      const chain: Record<string, unknown> = {};
      chain.from = (t: { __name: string }) => {
        tbl = t.__name;
        return chain;
      };
      chain.where = (p: Pred) => {
        pred = p;
        return chain;
      };
      chain.limit = () => chain;
      chain.then = (resolve: (rows: unknown[]) => unknown) => {
        return resolve(pgRows(tbl ?? '').filter((r) => evalPred(pred, r)));
      };
      return chain;
    },
    delete: (t: { __name: string }) => ({
      where: (p: Pred) => {
        deleteFromPg(t.__name, p);
        return Promise.resolve();
      },
    }),
  },
}));

vi.mock('@/db/postgres/schema/events', () => ({
  events: { __name: 'events', userId: { __field: 'userId' } },
}));
vi.mock('@/db/postgres/schema/mood-logs', () => ({
  moodLogs: { __name: 'mood_logs', userId: { __field: 'userId' } },
}));
vi.mock('@/db/postgres/schema/ai-generations', () => ({
  aiGenerations: { __name: 'ai_generations', userId: { __field: 'userId' } },
}));
vi.mock('@/db/postgres/schema/streaks', () => ({
  streaks: { __name: 'streaks', userId: { __field: 'userId' } },
}));
vi.mock('@/db/postgres/schema/weekly-insights', () => ({
  weeklyInsights: {
    __name: 'weekly_insights',
    userId: { __field: 'userId' },
  },
}));

// ── drizzle-orm helpers ──────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  eq: (col: { __field: string }, value: unknown): Pred => ({
    op: 'eq',
    field: col.__field,
    value,
  }),
  or: (...children: Pred[]): Pred => ({
    op: 'or',
    children: children.filter(Boolean),
  }),
  and: (...children: Pred[]): Pred => ({
    op: 'and',
    children: children.filter(Boolean),
  }),
  sql: () => ({}),
}));

// ── Stripe ───────────────────────────────────────────────────────────
vi.mock('@/modules/subscription/stripe.client', () => ({
  stripe: {
    subscriptions: {
      cancel: (id: string) => {
        if (state.stripeShouldThrow) {
          return Promise.reject(new Error('stripe down'));
        }
        state.stripeCanceled.push(id);
        return Promise.resolve({ id, status: 'canceled' });
      },
    },
  },
}));

// ── S3 ───────────────────────────────────────────────────────────────
vi.mock('@/modules/audio/audio.s3', () => ({
  deleteFile: (key: string) => {
    state.s3Deleted.push(key);
    return Promise.resolve();
  },
  buildSessionKey: (userId: string, sessionId: string) =>
    `audio/${userId}/${sessionId}.mp3`,
}));

// ── Logger ───────────────────────────────────────────────────────────
vi.mock('@/utils/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import * as svc from '@/modules/profile/profile.service';
import { AppError } from '@/utils/errors';

const USER = 'user-1';

beforeEach(() => {
  state.users.clear();
  state.sessions.clear();
  state.subscriptions.length = 0;
  state.favorites.length = 0;
  state.referrals.length = 0;
  state.events.length = 0;
  state.moodLogs.length = 0;
  state.aiGenerations.length = 0;
  state.streaks.clear();
  state.weeklyInsights.length = 0;
  state.stripeCanceled.length = 0;
  state.stripeShouldThrow = false;
  state.s3Deleted.length = 0;
  state.mysqlDeletes.length = 0;
});

describe('profile.service.getProfile', () => {
  it('throws a 404 AppError when the user is missing', async () => {
    await expect(svc.getProfile('nope')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    await expect(svc.getProfile('nope')).rejects.toBeInstanceOf(AppError);
  });
});

describe('profile.service.updateProfile', () => {
  it('deep-merges preferences instead of overwriting them', async () => {
    state.users.set(USER, {
      id: USER,
      name: 'Jane',
      avatarUrl: null,
      preferences: {
        theme: 'dark',
        defaultDuration: 10,
        goals: ['sleep better', 'feel calmer'],
      },
      referralCode: 'ABCD1234',
      referredBy: null,
    });

    const updated = await svc.updateProfile(USER, {
      preferences: { defaultDuration: 20 },
    });

    // Untouched keys must survive.
    expect(updated?.preferences).toMatchObject({
      theme: 'dark',
      defaultDuration: 20,
      goals: ['sleep better', 'feel calmer'],
    });
  });

  it('updates name and avatarUrl without touching preferences', async () => {
    state.users.set(USER, {
      id: USER,
      name: 'Old Name',
      avatarUrl: null,
      preferences: { theme: 'light' },
      referralCode: 'CODE',
      referredBy: null,
    });

    const updated = await svc.updateProfile(USER, {
      name: 'New Name',
      avatarUrl: 'https://cdn.example/a.png',
    });

    expect(updated?.name).toBe('New Name');
    expect(updated?.avatarUrl).toBe('https://cdn.example/a.png');
    expect(updated?.preferences).toEqual({ theme: 'light' });
  });

  it('is a no-op when no fields are provided', async () => {
    state.users.set(USER, {
      id: USER,
      name: 'Jane',
      avatarUrl: null,
      preferences: null,
      referralCode: 'CODE',
      referredBy: null,
    });

    const result = await svc.updateProfile(USER, {});
    expect(result?.name).toBe('Jane');
  });
});

describe('profile.service.getReferralStats', () => {
  it('counts invited and rewarded referrals and derives days earned', async () => {
    state.users.set(USER, {
      id: USER,
      name: 'Jane',
      avatarUrl: null,
      preferences: null,
      referralCode: 'MYCODE',
      referredBy: null,
    });
    state.referrals.push(
      { id: 'r1', referrerId: USER, referredId: 'u2', rewardApplied: true },
      { id: 'r2', referrerId: USER, referredId: 'u3', rewardApplied: true },
      { id: 'r3', referrerId: USER, referredId: 'u4', rewardApplied: false },
      { id: 'r4', referrerId: 'other', referredId: 'u5', rewardApplied: true }, // other user
    );

    const stats = await svc.getReferralStats(USER);
    expect(stats.code).toBe('MYCODE');
    expect(stats.shareUrl).toContain('?ref=MYCODE');
    expect(stats.totalInvited).toBe(3);
    expect(stats.totalRewarded).toBe(2);
    expect(stats.daysEarned).toBe(14); // 2 × 7
  });
});

describe('profile.service.exportUserData', () => {
  it('returns rows from every table we hold and strips oauthId', async () => {
    state.users.set(USER, {
      id: USER,
      name: 'Jane',
      avatarUrl: null,
      preferences: { theme: 'dark' },
      referralCode: 'CODE',
      referredBy: null,
    });
    // Simulate an oauthId on the row to verify it is stripped.
    (state.users.get(USER) as unknown as Record<string, unknown>).oauthId =
      'secret-oauth-id';

    state.sessions.set('s1', { id: 's1', userId: USER });
    state.subscriptions.push({
      id: 'sub',
      userId: USER,
      stripeSubscriptionId: 'stripe_1',
      status: 'active',
    });
    state.favorites.push({ userId: USER, sessionId: 's1' });
    state.referrals.push({
      id: 'r',
      referrerId: USER,
      referredId: 'u2',
      rewardApplied: true,
    });
    state.events.push({ userId: USER, eventType: 'session_play' });
    state.moodLogs.push({ userId: USER, rating: 4 });
    state.aiGenerations.push({ userId: USER });
    state.streaks.set(USER, { userId: USER, currentStreak: 3 });
    state.weeklyInsights.push({ userId: USER, insightText: 'nice week' });

    const exp = await svc.exportUserData(USER);

    expect(exp.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(exp.user).toBeDefined();
    expect((exp.user as Record<string, unknown>).oauthId).toBeUndefined();
    expect(exp.sessions).toHaveLength(1);
    expect(exp.subscriptions).toHaveLength(1);
    expect(exp.favorites).toHaveLength(1);
    expect(exp.referrals.asReferrer).toHaveLength(1);
    expect(exp.events).toHaveLength(1);
    expect(exp.moodLogs).toHaveLength(1);
    expect(exp.aiGenerations).toHaveLength(1);
    expect(exp.streak).toMatchObject({ currentStreak: 3 });
    expect(exp.weeklyInsights).toHaveLength(1);
  });

  it('throws 404 for unknown users', async () => {
    await expect(svc.exportUserData('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('profile.service.deleteAccount', () => {
  function seedFullAccount() {
    state.users.set(USER, {
      id: USER,
      name: 'Jane',
      avatarUrl: null,
      preferences: null,
      referralCode: 'CODE',
      referredBy: null,
    });
    state.sessions.set('s1', { id: 's1', userId: USER });
    state.sessions.set('s2', { id: 's2', userId: USER });
    state.subscriptions.push({
      id: 'sub',
      userId: USER,
      stripeSubscriptionId: 'stripe_1',
      status: 'active',
    });
    state.favorites.push({ userId: USER, sessionId: 's1' });
    state.referrals.push(
      { id: 'r1', referrerId: USER, referredId: 'u2', rewardApplied: true },
      { id: 'r2', referrerId: 'u3', referredId: USER, rewardApplied: false },
    );
    state.events.push({ userId: USER, eventType: 'session_play' });
    state.moodLogs.push({ userId: USER, rating: 4 });
    state.aiGenerations.push({ userId: USER });
    state.streaks.set(USER, { userId: USER, currentStreak: 3 });
    state.weeklyInsights.push({ userId: USER, insightText: 'x' });
  }

  it('cancels Stripe, wipes S3, and cascades across both databases', async () => {
    seedFullAccount();

    const result = await svc.deleteAccount(USER);
    expect(result).toEqual({ ok: true });

    // Stripe
    expect(state.stripeCanceled).toEqual(['stripe_1']);

    // S3: one delete per session
    expect(state.s3Deleted.sort()).toEqual([
      `audio/${USER}/s1.mp3`,
      `audio/${USER}/s2.mp3`,
    ]);

    // Postgres
    expect(state.events).toHaveLength(0);
    expect(state.moodLogs).toHaveLength(0);
    expect(state.aiGenerations).toHaveLength(0);
    expect(state.streaks.size).toBe(0);
    expect(state.weeklyInsights).toHaveLength(0);

    // MySQL — referrals in both directions should be gone, user row too,
    // and sessions/favorites/subscriptions removed via simulated cascade.
    expect(state.referrals).toHaveLength(0);
    expect(state.users.has(USER)).toBe(false);
    expect(state.sessions.size).toBe(0);
    expect(state.subscriptions).toHaveLength(0);
    expect(state.favorites).toHaveLength(0);
  });

  it('proceeds with deletion even when Stripe cancellation fails', async () => {
    seedFullAccount();
    state.stripeShouldThrow = true;

    const result = await svc.deleteAccount(USER);
    expect(result).toEqual({ ok: true });
    // Stripe call was attempted, but nothing was recorded because it threw.
    expect(state.stripeCanceled).toHaveLength(0);
    // User row is still gone.
    expect(state.users.has(USER)).toBe(false);
  });

  it('throws 404 when the user does not exist', async () => {
    await expect(svc.deleteAccount('ghost')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
