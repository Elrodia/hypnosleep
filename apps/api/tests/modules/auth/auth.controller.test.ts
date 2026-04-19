import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    REDIS_URL: 'redis://test',
    FRONTEND_URL: 'https://app.example.test',
  },
}));

const mysqlInsertValues = vi.fn();
const mysqlUpdateWhere = vi.fn();
const mysqlSelectLimit = vi.fn();

vi.mock('@/db/mysql/client', () => ({
  mysqlDb: {
    insert: () => ({ values: mysqlInsertValues }),
    update: () => ({
      set: () => ({
        where: mysqlUpdateWhere,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mysqlSelectLimit,
        }),
      }),
    }),
  },
}));

const redisSet = vi.fn();
const redisEval = vi.fn();
const redisDel = vi.fn();
const getRedis = vi.fn(() => ({
  set: redisSet,
  eval: redisEval,
  del: redisDel,
}));

vi.mock('@/db/redis/client', () => ({ getRedis }));

const loggerWarn = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn() },
}));

const { beginOAuthState, consumeOAuthState, decodeOAuthState } = await import(
  '@/modules/auth/auth.controller'
);

type TestRequest = {
  headers: Record<string, string | undefined>;
  ip: string;
  query: Record<string, string | undefined>;
};

type TestResponse = {
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
};

function makeReq(): TestRequest {
  return {
    headers: { 'user-agent': 'Vitest Agent' },
    ip: '192.168.1.12',
    query: {},
  };
}

function makeRes(): TestResponse {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

beforeEach(() => {
  mysqlInsertValues.mockReset();
  mysqlUpdateWhere.mockReset();
  mysqlSelectLimit.mockReset();
  redisSet.mockReset();
  redisEval.mockReset();
  redisDel.mockReset();
  getRedis.mockClear();
  loggerWarn.mockReset();

  mysqlInsertValues.mockResolvedValue(undefined);
  mysqlUpdateWhere.mockResolvedValue({ affectedRows: 1 });
  mysqlSelectLimit.mockResolvedValue([{ referralCode: 'REF123' }]);
  redisSet.mockResolvedValue('OK');
  redisEval.mockResolvedValue(null);
  redisDel.mockResolvedValue(1);
});

describe('auth.controller OAuth persistence fallback', () => {
  it('initiation succeeds when MySQL insert throws but Redis set succeeds', async () => {
    mysqlInsertValues.mockRejectedValueOnce(new Error('mysql down'));

    const req = makeReq();
    const res = makeRes();

    const encoded = await beginOAuthState(req as never, res as never, { provider: 'google' });
    const decoded = decodeOAuthState(encoded);

    expect(decoded).toBeTruthy();
    expect(decoded?.tx).toMatch(/[0-9a-f-]{36}/);
    expect(redisSet).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ txId: expect.any(String), err: expect.any(Error) }),
      'Failed to persist OAuth transaction in MySQL; attempting Redis fallback',
    );
  });

  it('callback consumes Redis-only tx successfully once', async () => {
    mysqlUpdateWhere.mockResolvedValueOnce({ affectedRows: 0 });

    const state = Buffer.from(JSON.stringify({ tx: 'tx-1', nonce: 'nonce-1' })).toString('base64url');
    const req = makeReq();
    req.query.state = state;
    req.headers.cookie = 'oauth_state=nonce-1';

    const res = makeRes();

    redisEval.mockResolvedValueOnce(JSON.stringify({ nonce: 'nonce-1', ref: 'ABC123' }));

    const result = await consumeOAuthState(req as never, res as never);

    expect(result.reason).toBeNull();
    expect(result.state).toEqual({ tx: 'tx-1', nonce: 'nonce-1', ref: 'ABC123' });
    expect(redisEval).toHaveBeenCalledTimes(1);
  });

  it('replay attempt on consumed Redis tx returns state_mismatch', async () => {
    mysqlUpdateWhere.mockResolvedValue({ affectedRows: 0 });

    const state = Buffer.from(JSON.stringify({ tx: 'tx-2', nonce: 'nonce-2' })).toString('base64url');
    const req = makeReq();
    req.query.state = state;
    req.headers.cookie = 'oauth_state=nonce-2';

    const res = makeRes();

    redisEval.mockResolvedValueOnce(JSON.stringify({ nonce: 'nonce-2' }));
    const first = await consumeOAuthState(req as never, res as never);

    redisEval.mockResolvedValueOnce(null);
    const second = await consumeOAuthState(req as never, res as never);

    expect(first.reason).toBeNull();
    expect(second).toEqual({ state: null, reason: 'state_mismatch' });
  });

  it('throws when both MySQL and Redis persistence fail (initiation_failed path)', async () => {
    mysqlInsertValues.mockRejectedValueOnce(new Error('mysql down'));
    redisSet.mockRejectedValueOnce(new Error('redis down'));

    await expect(
      beginOAuthState(makeReq() as never, makeRes() as never, { provider: 'google' }),
    ).rejects.toThrow('redis down');
  });
});
