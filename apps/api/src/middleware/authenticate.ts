import type { Request, Response, NextFunction } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { unauthenticated } from '../utils/errors.js';

const { verify } = jsonwebtoken;

export interface JwtPayload {
  userId: string;
  plan: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Express middleware to validate JWT bearer tokens.
 * Attaches decoded payload to `req.user` on success.
 * Returns 401 UNAUTHENTICATED on missing or invalid tokens.
 *
 * `JWT_SECRET` is validated in the central env schema at startup, so in
 * normal operation it will already be present. The secret is looked up per
 * request (rather than at factory time) so that a missing value does not
 * throw synchronously during route registration — instead it surfaces as a
 * 401 via `next(err)` and can be handled by the global error middleware.
 */
export function authenticate() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const secret = process.env.JWT_SECRET ?? '';
    if (!secret) {
      next(unauthenticated('Authentication is not configured'));
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next(unauthenticated('Missing or invalid Authorization header'));
      return;
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verify(token, secret) as JwtPayload;
      req.user = decoded;
      next();
    } catch {
      next(unauthenticated('Invalid or expired token'));
    }
  };
}

/**
 * SSE-friendly variant of {@link authenticate} that accepts the JWT
 * either via the standard `Authorization: Bearer <jwt>` header **or**
 * via a `?token=<jwt>` query parameter.
 *
 * The browser's `EventSource` API cannot set request headers, so the
 * frontend appends `?token=...` to the SSE endpoint URL. Using a
 * dedicated middleware (rather than always honouring the query
 * parameter) keeps the surface area for token leakage in URLs/logs
 * narrow — this should only be wired onto endpoints that genuinely
 * cannot use headers.
 *
 * Note: server-access logs may capture full URLs. If you change the
 * server's logging configuration, ensure `?token=` is redacted.
 */
export function authenticateFromQuery() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const secret = process.env.JWT_SECRET ?? '';
    if (!secret) {
      next(unauthenticated('Authentication is not configured'));
      return;
    }

    const queryToken =
      typeof req.query.token === 'string' ? req.query.token : null;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = queryToken ?? headerToken;

    if (!token) {
      next(unauthenticated('Missing authentication token'));
      return;
    }

    try {
      const decoded = verify(token, secret) as JwtPayload;
      req.user = decoded;
      next();
    } catch {
      next(unauthenticated('Invalid or expired token'));
    }
  };
}
