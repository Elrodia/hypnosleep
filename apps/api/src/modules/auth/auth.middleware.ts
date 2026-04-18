import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './auth.service.js';
import type { Plan } from '../../config/constants.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Authenticated user id, populated by `requireAuth`. */
    userId?: string;
    /** Authenticated user's plan, populated by `requireAuth`. */
    userPlan?: Plan;
  }
}

/**
 * Express middleware that requires a valid `Authorization: Bearer <jwt>`
 * header. On success, attaches `req.userId` and `req.userPlan`. On
 * failure responds 401 UNAUTHENTICATED — it never calls `next(err)` so
 * 401s don't get funneled through the generic error handler.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Missing or invalid Authorization header',
      },
    });
    return;
  }

  try {
    const payload = verifyJwt(header.slice(7));
    req.userId = payload.userId;
    req.userPlan = payload.plan;
    next();
  } catch {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' },
    });
  }
}

/**
 * Express middleware that gates a route behind a Pro subscription. Must
 * run **after** `requireAuth` so that `req.userPlan` is populated.
 * Returns 402 PRO_REQUIRED for free-plan users.
 */
export function requirePro(req: Request, res: Response, next: NextFunction): void {
  if (req.userPlan !== 'pro') {
    res.status(402).json({
      error: {
        code: 'PRO_REQUIRED',
        message: 'This feature requires a Pro subscription',
        details: { upgradeUrl: '/upgrade' },
      },
    });
    return;
  }
  next();
}
