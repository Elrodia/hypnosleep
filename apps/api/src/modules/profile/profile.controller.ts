import type { Request, Response, NextFunction } from 'express';
import { updateProfileSchema } from './profile.schema.js';
import {
  getProfile,
  updateProfile,
  getReferralStats,
  exportUserData,
  deleteAccount,
} from './profile.service.js';
import { validationFailed } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * Extracts the authenticated user id. Every route in this controller
 * is gated by `authenticate()`, so a missing `req.user` is an
 * internal invariant failure.
 */
function requireUserId(req: Request): string {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    throw new Error('Authenticated user id missing');
  }
  return user.userId;
}

/** GET /api/profile */
export async function handleGetProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ data: await getProfile(requireUserId(req)) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/profile */
export async function handleUpdateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationFailed('Invalid profile update', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const data = await updateProfile(requireUserId(req), parsed.data);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/profile/referral */
export async function handleReferralStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ data: await getReferralStats(requireUserId(req)) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/profile/export — GDPR data export.
 *
 * Returns a JSON blob containing every row we hold for the caller
 * across MySQL and Postgres, served with a
 * `Content-Disposition: attachment` header so browsers trigger a
 * download.
 */
export async function handleExportData(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await exportUserData(requireUserId(req));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="hypnosleep-export-${Date.now()}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/profile */
export async function handleDeleteAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await deleteAccount(requireUserId(req));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}
