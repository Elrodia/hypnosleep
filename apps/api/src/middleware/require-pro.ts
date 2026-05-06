import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { mysqlDb } from '../db/mysql/client.js';
import { users } from '../db/mysql/schema/users.js';
import { proRequired, unauthenticated } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Express middleware that gates routes behind a Pro subscription.
 *
 * Reads the authoritative `users.plan` value from MySQL rather than the
 * JWT's `plan` claim. The JWT is signed at sign-in time and embeds a
 * snapshot of the user's plan, but a user who upgrades mid-session
 * (Stripe checkout → webhook flips `users.plan` to `'pro'`) keeps the
 * old `'free'` claim until they re-authenticate. Trusting the JWT here
 * caused freshly-upgraded Pro users to receive `PRO_REQUIRED` errors
 * even after their billing was active.
 *
 * Returns 401 UNAUTHENTICATED when no JWT is attached (defence in
 * depth — `authenticate()` should have run first), and 402
 * PRO_REQUIRED when the user is on the free plan.
 */
export function requirePro() {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const user = (req as Record<string, unknown>).user as
      | { userId?: string; plan?: string }
      | undefined;

    if (!user?.userId) {
      next(unauthenticated());
      return;
    }

    try {
      const rows = await mysqlDb
        .select({ plan: users.plan })
        .from(users)
        .where(eq(users.id, user.userId))
        .limit(1);
      const plan = rows[0]?.plan;
      if (plan !== 'pro') {
        next(proRequired());
        return;
      }
      next();
    } catch (err) {
      // A DB outage shouldn't masquerade as a billing error. Log and
      // surface a generic 402 — the client retry path is the same and
      // we don't want to silently grant Pro access on a failed lookup.
      logger.warn({ err, userId: user.userId }, 'requirePro: DB lookup failed');
      next(proRequired());
    }
  };
}
