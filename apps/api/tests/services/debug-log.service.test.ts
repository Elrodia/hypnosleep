import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Env stub ──────────────────────────────────────────────────────────────
// Must be registered before importing anything that pulls in env.
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    DEBUG_LOG_RETENTION_DAYS: 30,
    DEBUG_LOG_SAMPLE_4XX_RATE: 0,
    DEBUG_LOG_SINK_URL: undefined,
    DEBUG_LOG_SINK_TOKEN: undefined,
    DEBUG_LOG_IP_HASH_PEPPER: 'pepper',
    ADMIN_USER_IDS: undefined,
  },
  validateAuthRuntimeConfig: () => undefined,
}));

// ── Drizzle client stub ──────────────────────────────────────────────────
// Capture every insert so we can assert redaction and column width caps.
interface CapturedInsert {
  values: Record<string, unknown>;
}
const captured: CapturedInsert[] = [];
const deleted: Array<{ cutoff: Date | null }> = [];

vi.mock('@/db/postgres/client', () => ({
  pgDb: {
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          captured.push({ values: row });
          return [
            {
              id: '00000000-0000-4000-8000-000000000000',
              createdAt: new Date('2026-04-21T00:00:00.000Z'),
              ...row,
            },
          ];
        },
      }),
    }),
    delete: () => ({
      where: (_pred: unknown) => ({
        returning: async () => {
          deleted.push({ cutoff: null });
          return [{ id: 'x' }];
        },
      }),
    }),
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.limit = () => Promise.resolve([]);
      return chain;
    },
  },
}));

const { recordDebugEvent, redactForDebugEvent, getDebugLogHealth } = await import(
  '@/services/debug-log.service'
);

beforeEach(() => {
  captured.length = 0;
  deleted.length = 0;
});

describe('services/debug-log — redaction', () => {
  it('strips obviously sensitive keys at every depth', () => {
    const out = redactForDebugEvent({
      authorization: 'Bearer secret',
      cookie: 'sid=abc',
      password: 'hunter2',
      token: 'tok_xxx',
      refresh_token: 'r_xxx',
      access_token: 'a_xxx',
      stripeCustomerId: 'cus_123',
      email: 'user@example.com',
      ok: 'value',
      nested: {
        api_key: 'sk_xxx',
        more: { id_token: 'id_xxx', fine: 'yes' },
      },
    }) as Record<string, unknown>;
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.cookie).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.token).toBe('[REDACTED]');
    expect(out.refresh_token).toBe('[REDACTED]');
    expect(out.access_token).toBe('[REDACTED]');
    expect(out.stripeCustomerId).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
    expect(out.ok).toBe('value');
    const nested = out.nested as Record<string, unknown>;
    expect(nested.api_key).toBe('[REDACTED]');
    const more = nested.more as Record<string, unknown>;
    expect(more.id_token).toBe('[REDACTED]');
    expect(more.fine).toBe('yes');
  });

  it('strips the OAuth authorization `code` field', () => {
    const out = redactForDebugEvent({ code: 'auth_code_xyz', codec: 'opus' }) as Record<
      string,
      unknown
    >;
    expect(out.code).toBe('[REDACTED]');
    expect(out.codec).toBe('opus'); // only exact `code` matches
  });

  it('truncates oversized strings rather than dropping them', () => {
    const long = 'a'.repeat(5000);
    const out = redactForDebugEvent({ note: long }) as Record<string, unknown>;
    const note = out.note as string;
    expect(note.length).toBeLessThan(5000);
    expect(note).toMatch(/\[\+\d+ch\]$/);
  });

  it('survives circular references', () => {
    const ref: Record<string, unknown> = { a: 1 };
    ref.self = ref;
    const out = redactForDebugEvent(ref) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out.self).toBe('[Circular]');
  });

  it('converts Error instances to name/message, never stack', () => {
    const err = new Error('boom with bearer tok_123');
    err.name = 'BoomError';
    const out = redactForDebugEvent({ err }) as Record<string, Record<string, unknown>>;
    expect(out.err.name).toBe('BoomError');
    expect(out.err.message).toContain('boom');
    expect('stack' in out.err).toBe(false);
  });
});

describe('services/debug-log — recordDebugEvent', () => {
  it('redacts context before insert and never writes raw IP', async () => {
    await recordDebugEvent({
      rid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      level: 'warn',
      category: 'oauth',
      reason: 'provider_error',
      message: 'Provider failed',
      userId: '11111111-1111-4111-8111-111111111111',
      context: {
        authorization: 'Bearer secret',
        provider: 'google',
        email: 'user@example.com',
      },
      error: Object.assign(new Error('oops'), { code: 'E_BOOM' }),
      method: 'get',
      path: '/api/auth/google/callback?code=s3cret&state=xyz',
      userAgent: 'UA',
      ip: '203.0.113.9',
    });

    expect(captured).toHaveLength(1);
    const row = captured[0].values;
    // Redacted context
    const ctx = row.context as Record<string, unknown>;
    expect(ctx.authorization).toBe('[REDACTED]');
    expect(ctx.email).toBe('[REDACTED]');
    expect(ctx.provider).toBe('google');
    // Path strips query string
    expect(row.path).toBe('/api/auth/google/callback');
    // IP is hashed, not raw
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(String(row.ipHash)).not.toContain('203.0.113.9');
    // Error fields propagated without stack
    expect(row.errorName).toBe('Error');
    expect(row.errorMessage).toBe('oops');
    expect(row.errorCode).toBe('E_BOOM');
    expect(row.method).toBe('GET');
    // rid preserved; userId truncated to 36
    expect(row.rid).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479');
    expect(row.userId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('falls back to rid="unknown" for malformed inbound ids', async () => {
    await recordDebugEvent({
      rid: 'not-a-uuid',
      level: 'error',
      category: 'http_5xx',
      message: 'boom',
    });
    expect(captured[0].values.rid).toBe('unknown');
  });

  it('updates health metrics on successful write', async () => {
    const before = getDebugLogHealth().totalWrites;
    await recordDebugEvent({
      rid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      level: 'info',
      category: 'other',
      message: 'hi',
    });
    const after = getDebugLogHealth();
    expect(after.totalWrites).toBe(before + 1);
    expect(after.lastWriteAt).not.toBeNull();
    expect(after.lastWriteError).toBeNull();
  });
});
