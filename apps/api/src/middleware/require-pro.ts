import type { Request, Response, NextFunction } from 'express';
import { proRequired } from '../utils/errors.js';

/**
 * Express middleware that gates routes behind a Pro subscription.
 * Checks the authenticated user's `plan` field.
 * Returns 402 PRO_REQUIRED if the user is on the free plan.
 */
export function requirePro() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as Record<string, unknown>).user as
      | { plan?: string }
      | undefined;

    if (!user || user.plan !== 'pro') {
      next(proRequired());
      return;
    }

    next();
  };
}
