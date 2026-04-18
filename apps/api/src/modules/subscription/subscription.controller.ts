import type { Request, Response, NextFunction } from 'express';
import { checkoutSchema } from './subscription.schema.js';
import {
  cancelSubscription,
  createCheckoutSession,
  createPortalSession,
  getStatus,
} from './subscription.service.js';
import { validationFailed } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * Extracts the authenticated user id set by the `authenticate()`
 * middleware. The middleware is mandatory on every route in this
 * controller, so missing `req.user` is an internal invariant
 * violation, not a client error.
 */
function requireUserId(req: Request): string {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    // Should be unreachable — the authenticate() middleware rejects
    // anonymous callers before this point.
    throw validationFailed('Authenticated user id missing');
  }
  return user.userId;
}

/** POST /api/subscription/checkout */
export async function handleCheckout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationFailed('Invalid checkout parameters', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await createCheckoutSession(requireUserId(req), parsed.data);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** POST /api/subscription/portal */
export async function handlePortal(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createPortalSession(requireUserId(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** POST /api/subscription/cancel */
export async function handleCancel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await cancelSubscription(requireUserId(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/subscription/status */
export async function handleStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getStatus(requireUserId(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
