import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

// ── Env stub ──────────────────────────────────────────────────────────────
// Must come before any import that transitively loads env.
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    DEBUG_LOG_RETENTION_DAYS: 30,
    DEBUG_LOG_SAMPLE_4XX_RATE: 0,
    DEBUG_LOG_SINK_URL: undefined,
    DEBUG_LOG_SINK_TOKEN: undefined,
    DEBUG_LOG_IP_HASH_PEPPER: 'pepper',
    ADMIN_USER_IDS: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
  validateAuthRuntimeConfig: () => undefined,
}));

// ── Auth middleware stub ─────────────────────────────────────────────────
// Let tests inject `req.userId` via a header so we can exercise the
// admin gate without wiring a real JWT.
vi.mock('@/modules/auth/auth.middleware', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    const uid = req.headers['x-test-user'];
    if (typeof uid === 'string' && uid.length > 0) {
      req.userId = uid;
    }
    next();
  },
}));

// ── Debug-log service stub ───────────────────────────────────────────────
const mockEvents = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    rid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    level: 'warn',
    category: 'oauth',
    reason: 'provider_error',
    userId: 'u',
    message: 'Provider failed',
    context: { provider: 'google' },
    errorName: 'Error',
    errorMessage: 'boom',
    errorCode: null,
    httpStatus: null,
    method: 'GET',
    path: '/api/auth/google/callback',
    userAgent: 'UA',
    ipHash: 'f'.repeat(64),
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
  },
];

// Mock the Postgres client so the error-handler's transitive
// dependency on `debug-log.service` (which imports `pgDb`) never
// opens a real DB connection during these tests.
vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    insert: () => ({
      values: () => ({ returning: async () => [] }),
    }),
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.limit = () => Promise.resolve([]);
      return chain;
    },
    delete: () => ({
      where: () => ({ returning: async () => [] }),
    }),
  },
}));

vi.mock('@/services/debug-log.service', () => ({
  getDebugEventsByRid: vi.fn(async (rid: string) =>
    rid === 'f47ac10b-58cc-4372-a567-0e02b2c3d479' ? mockEvents : [],
  ),
  listDebugEvents: vi.fn(async () => mockEvents),
  pruneOldDebugEvents: vi.fn(async () => 0),
  recordDebugEvent: vi.fn(async () => null),
  classifyHttpCategory: (s: number) => (s >= 500 ? 'http_5xx' : 'http_4xx'),
  shouldSample4xx: () => false,
  getDebugLogHealth: () => ({
    lastWriteAt: null,
    lastWriteDurationMs: null,
    lastWriteError: null,
    totalWrites: 0,
    totalFailures: 0,
    lastPruneAt: null,
    lastPruneDeleted: null,
    lastPruneError: null,
    lastSinkAt: null,
    lastSinkError: null,
  }),
}));

const { adminDebugRouter } = await import('@/modules/admin/debug.routes');
const { errorHandler } = await import('@/middleware/error-handler');

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/debug', adminDebugRouter);
  app.use(errorHandler);
  return app;
}

async function request(
  app: express.Express,
  method: 'get' | 'post',
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('no address'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}${path}`;
      fetch(url, { method: method.toUpperCase(), headers })
        .then(async (res) => {
          const text = await res.text();
          let body: any = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* keep raw */
          }
          server.close(() => resolve({ status: res.status, body }));
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });
  });
}

describe('admin/debug.routes — admin gate', () => {
  let app: express.Express;
  beforeEach(() => {
    app = makeApp();
  });

  it('401 when no user', async () => {
    const r = await request(app, 'get', '/api/admin/debug/events/f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('403 for non-admin authenticated user', async () => {
    const r = await request(
      app,
      'get',
      '/api/admin/debug/events/f47ac10b-58cc-4372-a567-0e02b2c3d479',
      { 'x-test-user': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    );
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  it('200 for admin user on known rid', async () => {
    const r = await request(
      app,
      'get',
      '/api/admin/debug/events/f47ac10b-58cc-4372-a567-0e02b2c3d479',
      { 'x-test-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    );
    expect(r.status).toBe(200);
    expect(r.body.data.rid).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(r.body.data.count).toBe(1);
  });

  it('404 for admin user on unknown rid', async () => {
    const r = await request(
      app,
      'get',
      '/api/admin/debug/events/99999999-9999-4999-8999-999999999999',
      { 'x-test-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    );
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
  });

  it('400 for admin user on malformed rid', async () => {
    const r = await request(app, 'get', '/api/admin/debug/events/not-a-uuid', {
      'x-test-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('200 on /events list for admin', async () => {
    const r = await request(app, 'get', '/api/admin/debug/events?limit=10', {
      'x-test-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.count).toBe(1);
  });

  it('403 on /events list for non-admin', async () => {
    const r = await request(app, 'get', '/api/admin/debug/events', {
      'x-test-user': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(r.status).toBe(403);
  });

  it('200 /health endpoint for admin', async () => {
    const r = await request(app, 'get', '/api/admin/debug/health', {
      'x-test-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.retentionDays).toBe(30);
    expect(r.body.data.sinkConfigured).toBe(false);
  });
});
