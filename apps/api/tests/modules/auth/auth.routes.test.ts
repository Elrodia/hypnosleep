import type { Request, Response, NextFunction } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/utils/errors';

const passportAuthenticate = vi.fn();
const passportUse = vi.fn();
vi.mock('passport', () => ({
  default: {
    authenticate: passportAuthenticate,
    use: passportUse,
  },
}));

vi.mock('@/modules/auth/strategies/google.strategy', () => ({ googleStrategy: {} }));
vi.mock('@/modules/auth/strategies/github.strategy', () => ({ githubStrategy: {} }));
vi.mock('@/modules/auth/strategies/microsoft.strategy', () => ({ microsoftStrategy: {} }));

vi.mock('@/middleware/rate-limit', () => ({
  rateLimit: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('@/config/constants', () => ({ RATE_LIMITS: { AUTH: { window: 60_000, max: 20 } } }));
vi.mock('@/modules/auth/auth.middleware', () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const consumeOAuthState = vi.fn();
const getOAuthRequestId = vi.fn(() => 'rid-test');
const handleOAuthCallback = vi.fn();
const logOAuthFailure = vi.fn();
const redirectOAuthError = vi.fn();

vi.mock('@/modules/auth/auth.controller', () => ({
  beginOAuthState: vi.fn(),
  consumeOAuthState,
  getOAuthRequestId,
  handleGetMe: vi.fn(),
  handleLogout: vi.fn(),
  handleOAuthCallback,
  logOAuthFailure,
  redirectOAuthError,
}));

const loggerWarn = vi.fn();
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: loggerWarn,
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { authRouter } = await import('@/modules/auth/auth.routes');

describe('auth.routes callback failure cleanup', () => {
  beforeEach(() => {
    passportAuthenticate.mockReset();
    consumeOAuthState.mockReset();
    getOAuthRequestId.mockClear();
    logOAuthFailure.mockReset();
    redirectOAuthError.mockReset();
    loggerWarn.mockReset();
  });

  function getGoogleCallbackMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    const layer = authRouter.stack.find(
      (entry): entry is { route: { path: string; stack: Array<{ handle: unknown }> } } =>
        'route' in entry && !!entry.route && entry.route.path === '/google/callback',
    );
    if (!layer) {
      throw new Error('Expected /google/callback route to exist');
    }
    const middleware = layer.route.stack[1]?.handle;
    if (typeof middleware !== 'function') {
      throw new Error('Expected callback middleware to exist');
    }
    return middleware as (req: Request, res: Response, next: NextFunction) => void;
  }

  it('consumes oauth state artifacts before redirect on provider error', async () => {
    let txInvalidated = false;
    consumeOAuthState.mockImplementation(async (_req: Request, res: Response) => {
      res.clearCookie('oauth_state', { path: '/api/auth' });
      txInvalidated = true;
      return { state: null, reason: 'state_missing' };
    });

    passportAuthenticate.mockImplementation(
      (_provider: string, _opts: { session: false }, cb: (err: Error, user: null) => void) =>
        (_req: Request, _res: Response, _next: NextFunction) => cb(new Error('oauth failed'), null),
    );

    const middleware = getGoogleCallbackMiddleware();

    const req = { query: { state: 'encoded-state' } } as unknown as Request;
    const res = {
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;

    middleware(req, res, vi.fn());
    await Promise.resolve();

    expect(consumeOAuthState).toHaveBeenCalledWith(req, res);
    expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', { path: '/api/auth' });
    expect(txInvalidated).toBe(true);
    expect(redirectOAuthError).toHaveBeenCalledWith(res, { reason: 'provider_error', rid: 'rid-test' });
    expect(logOAuthFailure).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ provider: 'google', reason: 'provider_error', rid: 'rid-test' }),
    );
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', rid: 'rid-test' }),
      'OAuth provider returned an error',
    );
  });

  it('preserves email_provider_mismatch reason and swallows cleanup errors', async () => {
    consumeOAuthState.mockRejectedValueOnce(new Error('cleanup unavailable'));

    passportAuthenticate.mockImplementation(
      (_provider: string, _opts: { session: false }, cb: (err: AppError, user: null) => void) =>
        (_req: Request, _res: Response, _next: NextFunction) =>
          cb(
            new AppError(
              'EMAIL_PROVIDER_MISMATCH',
              'This email is registered with github. Please log in with that provider.',
              409,
            ),
            null,
          ),
    );

    const middleware = getGoogleCallbackMiddleware();
    const req = {} as Request;
    const res = { redirect: vi.fn(), clearCookie: vi.fn() } as unknown as Response;

    expect(() => middleware(req, res, vi.fn())).not.toThrow();
    await Promise.resolve();

    expect(consumeOAuthState).toHaveBeenCalledWith(req, res);
    expect(redirectOAuthError).toHaveBeenCalledWith(res, {
      reason: 'email_provider_mismatch',
      rid: 'rid-test',
    });
    expect(logOAuthFailure).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ reason: 'email_provider_mismatch' }),
    );
  });
});
