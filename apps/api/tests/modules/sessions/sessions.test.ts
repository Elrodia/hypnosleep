import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Sessions service unit tests.
 *
 * The service is wired up to MySQL (Drizzle), Postgres (Drizzle),
 * Redis (ioredis), BullMQ, and S3. None of those are available in
 * the test environment, so each external boundary is replaced with
 * an in-memory fake via `vi.mock`.
 *
 * The fakes are stateful by design: they let us assert "did the
 * service write the right row?" without dragging a real database
 * into the unit test path.
 */

// ── Stateful in-memory fakes shared across mocks ───────────────────────
type Plan = 'free' | 'pro';
interface UserRow { id: string; plan: Plan }
interface SessionRow {
  id: string;
  userId: string;
  title: string;
  scriptText: string | null;
  category: string;
  durationSec: number;
  voiceId: string;
  backgroundSound: string | null;
  audioUrl: string | null;
  playCount: number;
  isTemplate: boolean;
  status: 'generating' | 'ready' | 'failed';
  createdAt: Date;
}
interface FavoriteRow { userId: string; sessionId: string }
interface UsageRow { userId: string; periodYyyymm: string; generationsCount: number }

const state = {
  users: new Map<string, UserRow>(),
  sessions: new Map<string, SessionRow>(),
  favorites: new Map<string, FavoriteRow>(), // key = `${userId}|${sessionId}`
  usage: new Map<string, UsageRow>(), // key = `${userId}|${period}`
  events: [] as Array<{ userId: string; sessionId: string | null; eventType: string; metadata: unknown }>,
  enqueued: [] as unknown[],
  s3Deleted: [] as string[],
  redisDeleted: [] as string[],
};

function favKey(u: string, s: string): string { return `${u}|${s}`; }
function usageKey(u: string, p: string): string { return `${u}|${p}`; }

/**
 * Minimal Drizzle-shaped fake. The chain captures the table the
 * query is targeting and the predicate passed to `.where(...)`, then
 * applies them against the in-memory `state` maps. Predicates carry
 * their own `{table, field, value}` tags (see the `drizzle-orm` mock
 * below) so we never need to wire a per-test "next where" hook.
 */
function makeMysqlFake() {
  const tableRows = (tbl: string): Record<string, unknown>[] => {
    if (tbl === 'users') return Array.from(state.users.values()) as unknown as Record<string, unknown>[];
    if (tbl === 'sessions') return Array.from(state.sessions.values()) as unknown as Record<string, unknown>[];
    if (tbl === 'favorites') return Array.from(state.favorites.values()) as unknown as Record<string, unknown>[];
    if (tbl === 'usage_counters') return Array.from(state.usage.values()) as unknown as Record<string, unknown>[];
    return [];
  };
  const tableName = (sym: unknown): string => {
    const obj = sym as { _?: { name?: string } } | undefined;
    return obj?._?.name ?? 'unknown';
  };

  const select = (fields?: Record<string, unknown>) => {
    const isCount = !!fields
      && Object.keys(fields).length === 1
      && 'total' in fields;
    let tbl: string | null = null;
    let pred: Pred | undefined;
    let limited = Number.POSITIVE_INFINITY;
    let offset = 0;
    const obj: Record<string, unknown> = {};
    obj.from = (sym: unknown) => { tbl = tableName(sym); return obj; };
    obj.innerJoin = (_sym: unknown, _on: unknown) => obj;
    obj.where = (p: Pred) => { pred = p; return obj; };
    obj.orderBy = (_o: unknown) => obj;
    obj.limit = (n: number) => { limited = n; return obj; };
    obj.offset = (n: number) => { offset = n; return obj; };
    obj.then = (resolve: (v: unknown[]) => unknown) => {
      const all = tbl ? tableRows(tbl) : [];
      const filtered = all.filter((r) => evalPred(pred, r));
      if (isCount) return Promise.resolve([{ total: filtered.length }]).then(resolve);
      let out = filtered.slice(offset);
      if (Number.isFinite(limited)) out = out.slice(0, limited);
      return Promise.resolve(out).then(resolve);
    };
    return obj;
  };

  const insert = (sym: unknown) => {
    const tbl = tableName(sym);
    return {
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const arr = Array.isArray(vals) ? vals : [vals];
        // For onDuplicateKeyUpdate we need to know if a conflict
        // occurred — track which inserted rows are "new" vs collisions.
        let conflicted = false;
        for (const v of arr) {
          if (tbl === 'sessions') {
            state.sessions.set(v.id as string, {
              audioUrl: null,
              scriptText: null,
              playCount: 0,
              backgroundSound: 'silence',
              createdAt: new Date(),
              ...(v as object),
            } as SessionRow);
          } else if (tbl === 'favorites') {
            const k = favKey(v.userId as string, v.sessionId as string);
            if (state.favorites.has(k)) conflicted = true;
            state.favorites.set(k, { userId: v.userId as string, sessionId: v.sessionId as string });
          } else if (tbl === 'usage_counters') {
            const k = usageKey(v.userId as string, v.periodYyyymm as string);
            if (state.usage.has(k)) {
              conflicted = true;
            } else {
              state.usage.set(k, {
                userId: v.userId as string,
                periodYyyymm: v.periodYyyymm as string,
                generationsCount: (v.generationsCount as number) ?? 0,
              });
            }
          }
        }
        const wrapper: Record<string, unknown> = {};
        wrapper.onDuplicateKeyUpdate = () => {
          if (conflicted && tbl === 'usage_counters') {
            for (const v of arr) {
              const k = usageKey(v.userId as string, v.periodYyyymm as string);
              const cur = state.usage.get(k);
              if (cur) cur.generationsCount += 1;
            }
          }
          return Promise.resolve();
        };
        wrapper.then = (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r);
        return wrapper;
      },
    };
  };

  const del = (sym: unknown) => {
    const tbl = tableName(sym);
    return {
      where: (p: Pred) => ({
        then: (r: (v: unknown) => unknown) => {
          if (tbl === 'sessions') {
            for (const row of [...state.sessions.values()]) {
              if (evalPred(p, row as unknown as Record<string, unknown>)) {
                state.sessions.delete(row.id);
              }
            }
          } else if (tbl === 'favorites') {
            for (const row of [...state.favorites.values()]) {
              if (evalPred(p, row as unknown as Record<string, unknown>)) {
                state.favorites.delete(favKey(row.userId, row.sessionId));
              }
            }
          }
          return Promise.resolve(undefined).then(r);
        },
      }),
    };
  };

  const update = (sym: unknown) => {
    const tbl = tableName(sym);
    return {
      set: (vals: Record<string, unknown>) => ({
        where: (p: Pred) => ({
          then: (r: (v: unknown) => unknown) => {
            if (tbl === 'sessions') {
              for (const row of state.sessions.values()) {
                if (!evalPred(p, row as unknown as Record<string, unknown>)) continue;
                for (const [k, v] of Object.entries(vals)) {
                  if (v && typeof v === 'object' && (v as { __sql?: boolean }).__sql) {
                    // Emulate `playCount + 1` style increments.
                    if (k === 'playCount') row.playCount += 1;
                  } else {
                    (row as unknown as Record<string, unknown>)[k] = v;
                  }
                }
              }
            }
            return Promise.resolve(undefined).then(r);
          },
        }),
      }),
    };
  };

  return { select, insert, delete: del, update, _state: state };
}

const mysqlFake = makeMysqlFake();

vi.mock('@/db/mysql/client', () => ({
  mysqlDb: new Proxy({}, {
    get(_t, prop) {
      if (prop === 'select') return mysqlFake.select;
      if (prop === 'insert') return mysqlFake.insert;
      if (prop === 'delete') return mysqlFake.delete;
      if (prop === 'update') return mysqlFake.update;
      return undefined;
    },
  }),
}));

// Schema imports — provide tagged column markers so our fake Drizzle
// mock can identify which column an `eq(...)` predicate is bound to
// and filter rows accordingly.
function col(table: string, name: string): { __field: string; __table: string } {
  return { __field: name, __table: table };
}
vi.mock('@/db/mysql/schema/sessions', () => ({
  sessions: {
    _: { name: 'sessions' },
    id: col('sessions', 'id'),
    userId: col('sessions', 'userId'),
    isTemplate: col('sessions', 'isTemplate'),
    status: col('sessions', 'status'),
    category: col('sessions', 'category'),
    title: col('sessions', 'title'),
    durationSec: col('sessions', 'durationSec'),
    playCount: col('sessions', 'playCount'),
    createdAt: col('sessions', 'createdAt'),
    scriptText: col('sessions', 'scriptText'),
    voiceId: col('sessions', 'voiceId'),
    backgroundSound: col('sessions', 'backgroundSound'),
    audioUrl: col('sessions', 'audioUrl'),
  },
}));
vi.mock('@/db/mysql/schema/favorites', () => ({
  favorites: {
    _: { name: 'favorites' },
    userId: col('favorites', 'userId'),
    sessionId: col('favorites', 'sessionId'),
  },
}));
vi.mock('@/db/mysql/schema/users', () => ({
  users: {
    _: { name: 'users' },
    id: col('users', 'id'),
    plan: col('users', 'plan'),
  },
}));
vi.mock('@/db/mysql/schema/usage-counters', () => ({
  usageCounters: {
    _: { name: 'usage_counters' },
    userId: col('usage_counters', 'userId'),
    periodYyyymm: col('usage_counters', 'periodYyyymm'),
    generationsCount: col('usage_counters', 'generationsCount'),
  },
}));

// Postgres event log → record into state.events so we can assert.
vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.events.push({
          userId: v.userId as string,
          sessionId: (v.sessionId as string | null) ?? null,
          eventType: v.eventType as string,
          metadata: v.metadata,
        });
        return { catch: () => undefined };
      },
    }),
  },
}));
vi.mock('@/db/postgres/schema/events', () => ({
  events: { _: { name: 'events' } },
}));

// Redis: track del() calls so we can assert cache invalidation.
vi.mock('@/db/redis/client', () => ({
  getRedis: () => ({
    del: (k: string) => { state.redisDeleted.push(k); return Promise.resolve(1); },
  }),
}));
// Helpers: cached() just calls through to the loader — we don't test
// the cache itself here.
vi.mock('@/db/redis/helpers', () => ({
  cached: <T,>(_k: string, _ttl: number, loader: () => Promise<T>) => loader(),
}));

// BullMQ queue — record enqueued payloads.
vi.mock('@/queues/audio-generation.queue', () => ({
  enqueueAudioGeneration: (data: unknown) => {
    state.enqueued.push(data);
    return Promise.resolve('job-id');
  },
}));

// AI service — generate a deterministic fake script so the service
// under test can run end-to-end without calling Gemini. Tests that
// need to exercise unsafe-script handling can override these via
// `vi.mocked(...).mockResolvedValueOnce(...)` per test.
vi.mock('@/modules/ai/ai.service', () => ({
  generateScript: vi.fn(async (input: { prompt: string }) => ({
    scriptText: `A calming script for: ${input.prompt}\n\nBreathe in. Breathe out.`,
    title: 'Generated Session',
    tokensInput: 42,
    tokensOutput: 128,
    generationMs: 10,
    estimatedSeconds: 600,
  })),
  checkScriptSafety: vi.fn(async () => ({ safe: true, flags: [] })),
}));

// S3 — record key deletions.
vi.mock('@/modules/audio/audio.s3', () => ({
  getStreamUrl: (key: string) => Promise.resolve(`https://signed.example/${key}`),
  deleteFile: (key: string) => { state.s3Deleted.push(key); return Promise.resolve(); },
  buildSessionKey: (userId: string, sessionId: string) => `audio/${userId}/${sessionId}.mp3`,
}));

// Drizzle helpers used inside the service. Predicates returned by
// `eq`/`and`/`or` carry their bound values so our fake DB can apply
// them to the in-memory state.
type Pred = { __op: 'eq'; field: string; table: string; value: unknown }
  | { __op: 'and'; children: Pred[] }
  | { __op: 'or'; children: Pred[] }
  | { __op: 'noop' };
function evalPred(p: Pred | undefined, row: Record<string, unknown>): boolean {
  if (!p) return true;
  if (p.__op === 'noop') return true;
  if (p.__op === 'eq') return row[p.field] === p.value;
  if (p.__op === 'and') return p.children.every((c) => evalPred(c, row));
  if (p.__op === 'or') return p.children.some((c) => evalPred(c, row));
  return true;
}
vi.mock('drizzle-orm', () => ({
  eq: (column: { __field?: string; __table?: string }, value: unknown): Pred => {
    if (column?.__field && column?.__table) {
      return { __op: 'eq', field: column.__field, table: column.__table, value };
    }
    return { __op: 'noop' };
  },
  and: (...x: unknown[]): Pred => ({
    __op: 'and',
    children: x.filter((c): c is Pred => !!c) as Pred[],
  }),
  or: (...x: unknown[]): Pred => ({
    __op: 'or',
    children: x.filter((c): c is Pred => !!c) as Pred[],
  }),
  desc: () => ({}),
  asc: () => ({}),
  like: () => ({ __op: 'noop' as const }),
  sql: Object.assign((..._a: unknown[]) => ({ __sql: true }), { raw: () => ({ __sql: true }) }),
}));

// ── System under test ────────────────────────────────────────────────
import {
  createGenerationSession,
  listSessions,
  getSessionById,
  getAudioUrl,
  deleteSession,
  toggleFavorite,
  recordPlay,
  editScript,
  regenerateAudio,
  getTrending,
} from '@/modules/sessions/sessions.service';
import { AppError } from '@/utils/errors';

const USER_FREE = 'user-free';
const USER_PRO = 'user-pro';
const OTHER_USER = 'user-other';

function reset(): void {
  state.users.clear();
  state.sessions.clear();
  state.favorites.clear();
  state.usage.clear();
  state.events.length = 0;
  state.enqueued.length = 0;
  state.s3Deleted.length = 0;
  state.redisDeleted.length = 0;
  state.users.set(USER_FREE, { id: USER_FREE, plan: 'free' });
  state.users.set(USER_PRO, { id: USER_PRO, plan: 'pro' });
  state.users.set(OTHER_USER, { id: OTHER_USER, plan: 'free' });
}

const baseGenerateInput = {
  userPrompt: 'Help me sleep tonight please',
  durationMin: 10,
  voiceId: 'en-US-AnaNeural', // free voice
  inductionStyle: 'progressive' as const,
  depthLevel: 'medium' as const,
  wakeUpAtEnd: false,
  background: 'rain' as const,
  category: 'sleep' as const,
};

describe('sessions.service', () => {
  beforeEach(() => reset());

  describe('createGenerationSession', () => {
    it('creates a generating row, enqueues a job, and increments usage for free users', async () => {
      const result = await createGenerationSession(USER_FREE, baseGenerateInput);

      expect(result.status).toBe('generating');
      expect(state.sessions.get(result.sessionId)?.status).toBe('generating');
      expect(state.sessions.get(result.sessionId)?.userId).toBe(USER_FREE);
      expect(state.sessions.get(result.sessionId)?.durationSec).toBe(600);
      expect(state.enqueued).toHaveLength(1);
      expect(state.usage.size).toBe(1);
      expect([...state.usage.values()][0].generationsCount).toBe(1);
      expect(state.events.find(e => e.eventType === 'session_create')).toBeTruthy();
    });

    it('blocks a free user that has hit the monthly generation limit', async () => {
      // Pre-fill the usage counter to the limit.
      const period = `${new Date().getUTCFullYear()}${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      state.usage.set(usageKey(USER_FREE, period), {
        userId: USER_FREE, periodYyyymm: period, generationsCount: 3,
      });

      await expect(createGenerationSession(USER_FREE, baseGenerateInput))
        .rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', statusCode: 429 });

      // No row was inserted, no job enqueued.
      expect(state.sessions.size).toBe(0);
      expect(state.enqueued).toHaveLength(0);
    });

    it('blocks a free user from selecting a Pro-only voice', async () => {
      await expect(
        createGenerationSession(USER_FREE, { ...baseGenerateInput, voiceId: 'en-GB-SoniaNeural' }),
      ).rejects.toMatchObject({ code: 'PRO_REQUIRED', statusCode: 402 });
      expect(state.sessions.size).toBe(0);
      expect(state.usage.size).toBe(0);
    });

    it('rejects unknown voice ids with a 400', async () => {
      await expect(
        createGenerationSession(USER_FREE, { ...baseGenerateInput, voiceId: 'made-up-voice' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', statusCode: 400 });
    });

    it('does not enforce the monthly limit for Pro users', async () => {
      const period = `${new Date().getUTCFullYear()}${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
      state.usage.set(usageKey(USER_PRO, period), {
        userId: USER_PRO, periodYyyymm: period, generationsCount: 999,
      });

      const result = await createGenerationSession(USER_PRO, baseGenerateInput);
      expect(result.status).toBe('generating');
      expect(state.enqueued).toHaveLength(1);
    });
  });

  describe('listSessions', () => {
    it('returns paginated rows with totals', async () => {
      // Five ready sessions for the user, one is a template owned by another.
      for (let i = 0; i < 4; i++) {
        state.sessions.set(`s-${i}`, {
          id: `s-${i}`, userId: USER_FREE, title: `Session ${i}`,
          scriptText: null, category: 'sleep', durationSec: 600,
          voiceId: 'en-US-AnaNeural', backgroundSound: 'rain', audioUrl: 's3://k',
          playCount: i, isTemplate: false, status: 'ready', createdAt: new Date(),
        });
      }
      state.sessions.set('tpl-1', {
        id: 'tpl-1', userId: 'system', title: 'Template',
        scriptText: null, category: 'sleep', durationSec: 600,
        voiceId: 'en-US-AnaNeural', backgroundSound: 'rain', audioUrl: 's3://k',
        playCount: 0, isTemplate: true, status: 'ready', createdAt: new Date(),
      });

      const page1 = await listSessions(USER_FREE, {
        category: 'all', sort: 'newest', favoritesOnly: false,
        includeTemplates: true, page: 1, limit: 2,
      });
      expect(page1.items).toHaveLength(2);
      // 4 own + 1 template = 5 visible; total comes from the count query.
      expect(page1.meta.total).toBe(5);
      expect(page1.meta.totalPages).toBe(3);
    });
  });

  describe('getSessionById', () => {
    it('blocks access to another user\'s private session', async () => {
      state.sessions.set('s-x', {
        id: 's-x', userId: OTHER_USER, title: 'Private',
        scriptText: 'secret', category: 'sleep', durationSec: 600,
        voiceId: 'en-US-AnaNeural', backgroundSound: 'rain', audioUrl: null,
        playCount: 0, isTemplate: false, status: 'ready', createdAt: new Date(),
      });

      await expect(getSessionById(USER_FREE, 's-x'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    });

    it('allows reading templates owned by other users', async () => {
      state.sessions.set('tpl', {
        id: 'tpl', userId: 'system', title: 'Sleep Template',
        scriptText: 'a'.repeat(500), category: 'sleep', durationSec: 600,
        voiceId: 'en-US-AnaNeural', backgroundSound: 'rain', audioUrl: null,
        playCount: 0, isTemplate: true, status: 'ready', createdAt: new Date(),
      });

      const r = await getSessionById(USER_FREE, 'tpl');
      expect(r.id).toBe('tpl');
      expect(r.scriptPreview).toHaveLength(200);
    });

    it('throws NOT_FOUND for unknown ids', async () => {
      await expect(getSessionById(USER_FREE, 'nope'))
        .rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });
  });

  describe('getAudioUrl', () => {
    it('returns a presigned URL for a ready, owned session', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      const url = await getAudioUrl(USER_FREE, 's');
      expect(url).toBe(`https://signed.example/audio/${USER_FREE}/s.mp3`);
    });

    it('refuses with 409 when the session is not ready', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'generating',
        createdAt: new Date(),
      });
      await expect(getAudioUrl(USER_FREE, 's'))
        .rejects.toBeInstanceOf(AppError);
      await expect(getAudioUrl(USER_FREE, 's'))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('deleteSession', () => {
    it('refuses to delete templates', async () => {
      state.sessions.set('tpl', {
        id: 'tpl', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: true, status: 'ready',
        createdAt: new Date(),
      });
      await expect(deleteSession(USER_FREE, 'tpl'))
        .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
      expect(state.sessions.has('tpl')).toBe(true);
    });

    it('removes the row and the S3 object for owned sessions', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      await deleteSession(USER_FREE, 's');
      expect(state.sessions.has('s')).toBe(false);
      expect(state.s3Deleted).toContain(`audio/${USER_FREE}/s.mp3`);
    });
  });

  describe('toggleFavorite', () => {
    it('adds a favorite when none exists, then removes it on a second call', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });

      const first = await toggleFavorite(USER_FREE, 's');
      expect(first).toBe(true);
      expect(state.favorites.size).toBe(1);

      const second = await toggleFavorite(USER_FREE, 's');
      expect(second).toBe(false);
      expect(state.favorites.size).toBe(0);
    });
  });

  describe('recordPlay', () => {
    it('increments play count, logs an event, and invalidates the trending cache', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_FREE, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 4, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      await recordPlay(USER_FREE, 's');
      expect(state.sessions.get('s')?.playCount).toBe(5);
      expect(state.events.find(e => e.eventType === 'session_play')).toBeTruthy();
      expect(state.redisDeleted).toContain('cache:trending');
    });
  });

  describe('editScript', () => {
    it('rewrites the script for a Pro-owned session', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_PRO, title: 't', scriptText: 'old', category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      await editScript(USER_PRO, 's', { scriptText: 'a'.repeat(60) });
      expect(state.sessions.get('s')?.scriptText).toBe('a'.repeat(60));
    });
  });

  describe('regenerateAudio', () => {
    it('re-enqueues with the new voice and flips status back to generating', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_PRO, title: 't', scriptText: 'script', category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      const r = await regenerateAudio(USER_PRO, 's', { voiceId: 'en-GB-SoniaNeural' }, true);
      expect(r.status).toBe('generating');
      expect(state.enqueued).toHaveLength(1);
      expect((state.enqueued[0] as { voiceId: string }).voiceId).toBe('en-GB-SoniaNeural');
    });

    it('refuses to regenerate before a script has been generated', async () => {
      state.sessions.set('s', {
        id: 's', userId: USER_PRO, title: 't', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 0, isTemplate: false, status: 'generating',
        createdAt: new Date(),
      });
      await expect(regenerateAudio(USER_PRO, 's', {}, true))
        .rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('getTrending', () => {
    it('returns ready templates only and excludes private sessions', async () => {
      // A ready template — should appear.
      state.sessions.set('tpl', {
        id: 'tpl', userId: 'system', title: 'T', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 100, isTemplate: true, status: 'ready',
        createdAt: new Date(),
      });
      // A private (non-template) session — must be excluded even with
      // a much higher play count.
      state.sessions.set('priv', {
        id: 'priv', userId: USER_FREE, title: 'P', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 999, isTemplate: false, status: 'ready',
        createdAt: new Date(),
      });
      // A still-generating template — must be excluded by the
      // `status='ready'` filter.
      state.sessions.set('tpl-gen', {
        id: 'tpl-gen', userId: 'system', title: 'G', scriptText: null, category: 'sleep',
        durationSec: 600, voiceId: 'en-US-AnaNeural', backgroundSound: 'rain',
        audioUrl: null, playCount: 50, isTemplate: true, status: 'generating',
        createdAt: new Date(),
      });

      const result = await getTrending();
      expect(result.map(r => r.id)).toEqual(['tpl']);
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });
});
