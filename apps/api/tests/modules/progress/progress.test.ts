import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Progress service unit tests.
 *
 * The service orchestrates Postgres (mood logs, events, streaks,
 * weekly insights) and MySQL (sessions totals), plus Gemini for the
 * weekly reflection. None of those are available in the test
 * environment, so each external boundary is replaced with a stateful
 * in-memory fake via `vi.mock`.
 *
 * Tests run against a single shared `state` object that is reset in
 * `beforeEach`; each test seeds the state it needs and then asserts
 * both the returned payload and the resulting state mutations.
 */

// ── In-memory state shared by all mocks ────────────────────────────────
interface StreakRow {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastListenDate: string | null;
  updatedAt: Date;
}
interface MoodLogRow {
  userId: string;
  sessionId: string;
  rating: number;
  note: string | null;
  createdAt: Date;
}
interface EventRow {
  userId: string | null;
  sessionId: string | null;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
}
interface WeeklyInsightRow {
  userId: string;
  insightText: string;
  weekStart: string;
  createdAt: Date;
}
interface SessionRow {
  id: string;
  userId: string;
  category: string;
  durationSec: number;
  status: 'generating' | 'ready' | 'failed';
}

const state = {
  streaks: new Map<string, StreakRow>(),
  moodLogs: [] as MoodLogRow[],
  events: [] as EventRow[],
  weeklyInsights: [] as WeeklyInsightRow[],
  sessions: new Map<string, SessionRow>(),
  geminiCalls: [] as string[],
  /**
   * When set, the next Gemini call rejects with this error — lets
   * individual tests simulate an upstream outage without touching
   * shared globals.
   */
  geminiThrow: null as Error | null,
  geminiResponse: 'A lovely week of progress.',
};

// ── pgDb fake ─────────────────────────────────────────────────────────
// Drizzle-orm `eq`/`and`/`gte` helpers return tagged predicates that
// the fake select chain evaluates against in-memory rows.
type Pred =
  | { op: 'eq'; field: string; value: unknown }
  | { op: 'gte'; field: string; value: unknown }
  | { op: 'and'; children: Pred[] };

function evalPred(p: Pred | undefined, row: Record<string, unknown>): boolean {
  if (!p) return true;
  if (p.op === 'eq') return row[p.field] === p.value;
  if (p.op === 'gte') {
    const v = row[p.field];
    if (v instanceof Date && p.value instanceof Date) {
      return v.getTime() >= p.value.getTime();
    }
    return (v as number) >= (p.value as number);
  }
  if (p.op === 'and') return p.children.every((c) => evalPred(c, row));
  return true;
}

function pgRows(tableName: string): Record<string, unknown>[] {
  if (tableName === 'streaks')
    return Array.from(state.streaks.values()) as unknown as Record<string, unknown>[];
  if (tableName === 'mood_logs')
    return state.moodLogs as unknown as Record<string, unknown>[];
  if (tableName === 'events')
    return state.events as unknown as Record<string, unknown>[];
  if (tableName === 'weekly_insights')
    return state.weeklyInsights as unknown as Record<string, unknown>[];
  return [];
}

function makePgSelect() {
  return (f?: Record<string, { __agg?: string; __field?: string }>) => {
    let tbl: string | null = null;
    let pred: Pred | undefined;
    let limited = Number.POSITIVE_INFINITY;
    const fields = f ?? null;
    const chain: Record<string, unknown> = {};
    chain.from = (t: { __name: string }) => {
      tbl = t.__name;
      return chain;
    };
    chain.where = (p: Pred) => {
      pred = p;
      return chain;
    };
    chain.limit = (n: number) => {
      limited = n;
      return chain;
    };
    chain.groupBy = () => chain;
    chain.orderBy = () => chain;
    chain.then = (resolve: (rows: unknown[]) => unknown) => {
      const rows = pgRows(tbl ?? '').filter((r) => evalPred(pred, r));
      let result: unknown[] = rows;
      if (fields) {
        if (fields.count || fields.avgRating) {
          const byDate = new Map<string, { count: number; sum: number }>();
          for (const r of rows) {
            const created = (r.createdAt as Date) ?? new Date();
            const date = created.toISOString().slice(0, 10);
            const entry = byDate.get(date) ?? { count: 0, sum: 0 };
            entry.count++;
            entry.sum += (r.rating as number) ?? 1;
            byDate.set(date, entry);
          }
          result = Array.from(byDate.entries()).map(([date, v]) => ({
            date,
            count: v.count,
            avgRating: v.sum / v.count,
          }));
        } else {
          result = rows.map((r) => {
            const out: Record<string, unknown> = {};
            for (const k of Object.keys(fields)) {
              out[k] = r[k];
            }
            return out;
          });
        }
      }
      if (result.length > limited) result = result.slice(0, limited);
      return resolve(result);
    };
    return chain;
  };
}

const pgInserts: Array<{ table: string; values: Record<string, unknown> }> = [];
const pgUpdates: Array<{ table: string; values: Record<string, unknown>; pred: Pred | undefined }> =
  [];
const pgDeletes: Array<{ table: string; pred: Pred | undefined }> = [];

function makePgInsert() {
  return (t: { __name: string }) => ({
    values: (v: Record<string, unknown> | Record<string, unknown>[]) => {
      const vals = Array.isArray(v) ? v : [v];
      for (const val of vals) {
        pgInserts.push({ table: t.__name, values: val });
        const withDates = { createdAt: new Date(), ...val };
        if (t.__name === 'streaks') {
          state.streaks.set(val.userId as string, withDates as StreakRow);
        } else if (t.__name === 'mood_logs') {
          state.moodLogs.push(withDates as MoodLogRow);
        } else if (t.__name === 'events') {
          state.events.push(withDates as EventRow);
        } else if (t.__name === 'weekly_insights') {
          state.weeklyInsights.push(withDates as WeeklyInsightRow);
        }
      }
      const promise: Promise<void> & { catch: (fn: (e: unknown) => void) => Promise<void> } = Object.assign(
        Promise.resolve(),
        {
          catch(fn: (e: unknown) => void) {
            return Promise.resolve().catch(fn);
          },
        },
      );
      return promise;
    },
  });
}

function makePgUpdate() {
  return (t: { __name: string }) => {
    let vals: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    chain.set = (v: Record<string, unknown>) => {
      vals = v;
      return chain;
    };
    chain.where = (p: Pred) => {
      pgUpdates.push({ table: t.__name, values: vals, pred: p });
      if (t.__name === 'streaks') {
        // Find matching row and update
        for (const row of state.streaks.values()) {
          if (evalPred(p, row as unknown as Record<string, unknown>)) {
            Object.assign(row, vals);
          }
        }
      }
      return Promise.resolve();
    };
    return chain;
  };
}

function makePgDelete() {
  return (t: { __name: string }) => ({
    where: (p: Pred) => {
      pgDeletes.push({ table: t.__name, pred: p });
      return Promise.resolve();
    },
  });
}

vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    select: makePgSelect(),
    insert: makePgInsert(),
    update: makePgUpdate(),
    delete: makePgDelete(),
  },
}));

vi.mock('@/db/postgres/schema/mood-logs', () => ({
  moodLogs: {
    __name: 'mood_logs',
    userId: { __field: 'userId' },
    sessionId: { __field: 'sessionId' },
    rating: { __field: 'rating' },
    note: { __field: 'note' },
    createdAt: { __field: 'createdAt' },
  },
}));
vi.mock('@/db/postgres/schema/events', () => ({
  events: {
    __name: 'events',
    userId: { __field: 'userId' },
    sessionId: { __field: 'sessionId' },
    eventType: { __field: 'eventType' },
    metadata: { __field: 'metadata' },
    createdAt: { __field: 'createdAt' },
  },
}));
vi.mock('@/db/postgres/schema/streaks', () => ({
  streaks: {
    __name: 'streaks',
    userId: { __field: 'userId' },
    currentStreak: { __field: 'currentStreak' },
    longestStreak: { __field: 'longestStreak' },
    lastListenDate: { __field: 'lastListenDate' },
    updatedAt: { __field: 'updatedAt' },
  },
}));
vi.mock('@/db/postgres/schema/weekly-insights', () => ({
  weeklyInsights: {
    __name: 'weekly_insights',
    userId: { __field: 'userId' },
    insightText: { __field: 'insightText' },
    weekStart: { __field: 'weekStart' },
    createdAt: { __field: 'createdAt' },
  },
}));

// ── mysqlDb fake ──────────────────────────────────────────────────────
vi.mock('@/db/mysql/client', () => ({
  mysqlDb: {
    select: (fields?: Record<string, unknown>) => {
      let pred: Pred | undefined;
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (p: Pred) => {
        pred = p;
        return chain;
      };
      chain.limit = () => chain;
      chain.then = (resolve: (rows: unknown[]) => unknown) => {
        const rows = Array.from(state.sessions.values()).filter((r) =>
          evalPred(pred, r as unknown as Record<string, unknown>),
        );
        if (fields && 'totalSessions' in fields) {
          const totalSec = rows.reduce((s, r) => s + r.durationSec, 0);
          return resolve([{ totalSessions: rows.length, totalSec }]);
        }
        if (fields && 'category' in fields) {
          return resolve(rows.map((r) => ({ category: r.category })));
        }
        return resolve(rows);
      };
      return chain;
    },
  },
}));

vi.mock('@/db/mysql/schema/sessions', () => ({
  sessions: {
    __name: 'sessions',
    id: { __field: 'id' },
    userId: { __field: 'userId' },
    category: { __field: 'category' },
    durationSec: { __field: 'durationSec' },
    status: { __field: 'status' },
  },
}));

// ── drizzle-orm helpers ───────────────────────────────────────────────
vi.mock('drizzle-orm', () => ({
  eq: (col: { __field: string }, value: unknown): Pred => ({
    op: 'eq',
    field: col.__field,
    value,
  }),
  and: (...children: Pred[]): Pred => ({
    op: 'and',
    children: children.filter(Boolean),
  }),
  gte: (col: { __field: string }, value: unknown): Pred => ({
    op: 'gte',
    field: col.__field,
    value,
  }),
  inArray: (col: { __field: string }, values: unknown[]): Pred => ({
    op: 'and',
    children: values.map((v) => ({ op: 'eq', field: col.__field, value: v }) as Pred),
  }),
  sql: () => ({}),
  desc: () => ({}),
}));

// ── Gemini ────────────────────────────────────────────────────────────
vi.mock('@/modules/ai/ai.gemini', () => ({
  callGemini: (prompt: string) => {
    state.geminiCalls.push(prompt);
    if (state.geminiThrow) return Promise.reject(state.geminiThrow);
    return Promise.resolve({
      text: state.geminiResponse,
      tokensInput: 100,
      tokensOutput: 50,
    });
  },
}));

// ── Logger (silence) ──────────────────────────────────────────────────
vi.mock('@/utils/logger', () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

// ── Imports under test (after all mocks are registered) ───────────────
import * as svc from '@/modules/progress/progress.service';
import { generateWeeklyInsight } from '@/modules/progress/progress.insights';

beforeEach(() => {
  state.streaks.clear();
  state.moodLogs.length = 0;
  state.events.length = 0;
  state.weeklyInsights.length = 0;
  state.sessions.clear();
  state.geminiCalls.length = 0;
  state.geminiThrow = null;
  state.geminiResponse = 'A lovely week of progress.';
  pgInserts.length = 0;
  pgUpdates.length = 0;
  pgDeletes.length = 0;
});

const USER = '11111111-1111-1111-1111-111111111111';
const SESSION = '22222222-2222-2222-2222-222222222222';

describe('progress.service.logMood', () => {
  it('inserts a mood log row and initializes streak to 1 on first call', async () => {
    const result = await svc.logMood(USER, {
      sessionId: SESSION,
      rating: 4,
      note: 'felt great',
    });

    expect(result).toEqual({ ok: true });
    expect(state.moodLogs).toHaveLength(1);
    expect(state.moodLogs[0]).toMatchObject({
      userId: USER,
      sessionId: SESSION,
      rating: 4,
      note: 'felt great',
    });

    const streak = state.streaks.get(USER);
    expect(streak).toBeDefined();
    expect(streak?.currentStreak).toBe(1);
    expect(streak?.longestStreak).toBe(1);
  });

  it('writes a mood_logged analytics event', async () => {
    await svc.logMood(USER, { sessionId: SESSION, rating: 5 });
    // Wait a microtask for the fire-and-forget event write to flush.
    await Promise.resolve();
    const moodEvents = state.events.filter((e) => e.eventType === 'mood_logged');
    expect(moodEvents).toHaveLength(1);
    expect(moodEvents[0]).toMatchObject({
      userId: USER,
      sessionId: SESSION,
      metadata: { rating: 5 },
    });
  });

  it('is a no-op on streak when called twice the same UTC day', async () => {
    await svc.logMood(USER, { sessionId: SESSION, rating: 3 });
    await svc.logMood(USER, { sessionId: SESSION, rating: 4 });

    const streak = state.streaks.get(USER);
    expect(streak?.currentStreak).toBe(1);
    // Two mood rows, one streak entry.
    expect(state.moodLogs).toHaveLength(2);
  });

  it('increments streak when last listen was exactly yesterday', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    state.streaks.set(USER, {
      userId: USER,
      currentStreak: 5,
      longestStreak: 5,
      lastListenDate: yesterday,
      updatedAt: new Date(),
    });

    await svc.logMood(USER, { sessionId: SESSION, rating: 4 });

    const streak = state.streaks.get(USER);
    expect(streak?.currentStreak).toBe(6);
    expect(streak?.longestStreak).toBe(6);
  });

  it('resets streak to 1 when the gap is greater than one day', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    state.streaks.set(USER, {
      userId: USER,
      currentStreak: 10,
      longestStreak: 10,
      lastListenDate: fiveDaysAgo,
      updatedAt: new Date(),
    });

    await svc.logMood(USER, { sessionId: SESSION, rating: 4 });

    const streak = state.streaks.get(USER);
    expect(streak?.currentStreak).toBe(1);
    // Longest must never decrease on a reset.
    expect(streak?.longestStreak).toBe(10);
  });
});

describe('progress.service.getStats', () => {
  it('returns zeros when the user has no data', async () => {
    const stats = await svc.getStats(USER);
    expect(stats).toEqual({
      totalSessions: 0,
      totalMinutes: 0,
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('aggregates session totals and surfaces current streak', async () => {
    state.sessions.set('s1', {
      id: 's1',
      userId: USER,
      category: 'sleep',
      durationSec: 600,
      status: 'ready',
    });
    state.sessions.set('s2', {
      id: 's2',
      userId: USER,
      category: 'focus',
      durationSec: 900,
      status: 'ready',
    });
    state.sessions.set('s3', {
      id: 's3',
      userId: USER,
      category: 'sleep',
      durationSec: 999,
      status: 'generating', // should be excluded
    });
    state.streaks.set(USER, {
      userId: USER,
      currentStreak: 3,
      longestStreak: 7,
      lastListenDate: '2024-01-01',
      updatedAt: new Date(),
    });

    const stats = await svc.getStats(USER);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalMinutes).toBe(25); // (600 + 900) / 60
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(7);
  });
});

describe('progress.service.getStreak', () => {
  it('returns zeros when no row exists', async () => {
    const s = await svc.getStreak(USER);
    expect(s).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastListenDate: null,
    });
  });
});

describe('progress.service.getHeatmap', () => {
  it('counts session_play events per UTC day within the window', async () => {
    const now = new Date();
    state.events.push(
      {
        userId: USER,
        sessionId: SESSION,
        eventType: 'session_play',
        metadata: null,
        createdAt: now,
      },
      {
        userId: USER,
        sessionId: SESSION,
        eventType: 'session_play',
        metadata: null,
        createdAt: now,
      },
      {
        userId: USER,
        sessionId: SESSION,
        eventType: 'mood_logged', // excluded by eventType filter
        metadata: null,
        createdAt: now,
      },
    );

    const rows = await svc.getHeatmap(USER, 90);
    const today = now.toISOString().slice(0, 10);
    expect(rows).toContainEqual({ date: today, count: 2 });
  });
});

describe('progress.insights.generateWeeklyInsight', () => {
  it('returns a canned encouragement when the user has fewer than 2 plays', async () => {
    const insight = await generateWeeklyInsight(USER, '2024-01-01');
    expect(insight).toContain('getting started');
    // No Gemini call should have been made.
    expect(state.geminiCalls).toHaveLength(0);
  });

  it('calls Gemini when there is enough activity and caches nothing itself', async () => {
    state.sessions.set('s1', {
      id: 's1',
      userId: USER,
      category: 'sleep',
      durationSec: 600,
      status: 'ready',
    });
    state.events.push(
      {
        userId: USER,
        sessionId: 's1',
        eventType: 'session_play',
        metadata: null,
        createdAt: new Date(),
      },
      {
        userId: USER,
        sessionId: 's1',
        eventType: 'session_play',
        metadata: null,
        createdAt: new Date(),
      },
    );

    state.geminiResponse = 'You stacked three sleep sessions — nice rhythm.';
    const insight = await generateWeeklyInsight(USER, '2024-01-01');

    expect(insight).toBe('You stacked three sleep sessions — nice rhythm.');
    expect(state.geminiCalls).toHaveLength(1);
    // The prompt must reference the session count and the top category.
    expect(state.geminiCalls[0]).toContain('2 hypnosis sessions');
    expect(state.geminiCalls[0]).toContain('sleep');
  });

  it('falls back to a deterministic string when Gemini throws', async () => {
    state.events.push(
      {
        userId: USER,
        sessionId: 's1',
        eventType: 'session_play',
        metadata: null,
        createdAt: new Date(),
      },
      {
        userId: USER,
        sessionId: 's1',
        eventType: 'session_play',
        metadata: null,
        createdAt: new Date(),
      },
    );
    state.geminiThrow = new Error('gemini down');

    const insight = await generateWeeklyInsight(USER, '2024-01-01');
    expect(insight).toContain('2 sessions');
    expect(insight).toContain('Keep going');
  });
});

describe('progress.service.getWeeklyInsight (caching)', () => {
  it('returns the existing row without regenerating when one exists', async () => {
    // Seed a pre-existing insight for "this" week (any week_start works
    // because our fake select ignores the week_start predicate when the
    // mood_logs table is empty — but the row matches by userId).
    //
    // Compute the expected weekStart the same way the service does.
    const d = new Date();
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff))
      .toISOString()
      .slice(0, 10);

    state.weeklyInsights.push({
      userId: USER,
      insightText: 'cached insight',
      weekStart,
      createdAt: new Date(),
    });

    const result = await svc.getWeeklyInsight(USER);
    expect(result.insight).toBe('cached insight');
    expect(result.weekStart).toBe(weekStart);
    // Gemini must not have been called.
    expect(state.geminiCalls).toHaveLength(0);
    // No new row should have been inserted.
    const inserted = pgInserts.filter((i) => i.table === 'weekly_insights');
    expect(inserted).toHaveLength(0);
  });

  it('generates and persists a new row when none is cached', async () => {
    const result = await svc.getWeeklyInsight(USER);
    // Low-data branch: no plays ⇒ canned encouragement, no Gemini call,
    // but the result is still cached for the week.
    expect(result.insight).toContain('getting started');
    const inserted = pgInserts.filter((i) => i.table === 'weekly_insights');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].values).toMatchObject({
      userId: USER,
      insightText: result.insight,
      weekStart: result.weekStart,
    });
  });
});
