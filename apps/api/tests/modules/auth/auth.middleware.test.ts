import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-mw',
    JWT_EXPIRES_IN: '1h',
    FRONTEND_URL: 'https://app.example.test',
    API_URL: 'https://api.example.test',
  },
}));

vi.mock('@/db/mysql/client', () => ({ mysqlDb: {} }));
vi.mock('@/db/postgres/client', () => ({ pgDb: {} }));
vi.mock('@/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { requireAuth, requirePro } = await import('@/modules/auth/auth.middleware');
const { issueJwt } = await import('@/modules/auth/auth.service');

function makeRes() {
  const res: Partial<Response> & { _status?: number; _body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = vi.fn((body: unknown) => {
    res._body = body;
    return res as Response;
  }) as unknown as Response['json'];
  return res as Response & { _status?: number; _body?: unknown };
}

describe('requireAuth', () => {
  it('401s when Authorization header is missing', () => {
    const req = { headers: {} } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect((res._body as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
  });

  it('401s when the bearer token is invalid', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('populates userId and userPlan on success', () => {
    const token = issueJwt({ id: 'abc', plan: 'pro' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = makeRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe('abc');
    expect(req.userPlan).toBe('pro');
  });
});

describe('requirePro', () => {
  it('402s free users', () => {
    const req = { userPlan: 'free' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requirePro(req, res, next as NextFunction);
    expect(res._status).toBe(402);
    expect((res._body as { error: { code: string } }).error.code).toBe('PRO_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for pro users', () => {
    const req = { userPlan: 'pro' } as Request;
    const res = makeRes();
    const next = vi.fn();
    requirePro(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
