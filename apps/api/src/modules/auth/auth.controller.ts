import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { mysqlDb } from '../../db/mysql/client.js';
import { users, type User } from '../../db/mysql/schema/users.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { issueJwt } from './auth.service.js';
import type { OAuthState } from './auth.types.js';

/**
 * Base64url-encode the OAuth `state` payload so it survives the
 * provider round-trip intact. We only carry non-secret data (a referral
 * code) here — no CSRF protection relies on this blob.
 */
export function encodeOAuthState(state: OAuthState): string | undefined {
  if (!state.ref) return undefined;
  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/** Best-effort decode of `state`. Malformed values are silently ignored. */
export function decodeOAuthState(raw: unknown): OAuthState {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString()) as unknown;
    if (parsed && typeof parsed === 'object' && 'ref' in parsed) {
      const ref = (parsed as { ref?: unknown }).ref;
      if (typeof ref === 'string' && ref.length > 0) return { ref };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * If the login carried a `ref=CODE` in the OAuth state, attach the
 * referrer to the newly-authenticated user — but only when the user
 * hasn't already been attributed and isn't referring themselves.
 *
 * Referral *rewards* (free Pro days, etc.) are applied by the
 * subscription module; this function only sets the `referredBy` pointer.
 */
async function applyReferral(user: User, ref: string): Promise<void> {
  if (user.referredBy) return;

  const referrer = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.referralCode, ref))
    .limit(1);

  if (!referrer[0] || referrer[0].id === user.id) return;

  await mysqlDb
    .update(users)
    .set({ referredBy: referrer[0].id })
    .where(eq(users.id, user.id));
}

/**
 * Final step of an OAuth callback: maybe apply a referral code, issue a
 * JWT, and redirect back to the frontend's callback page with the token
 * in the query string. The frontend is responsible for moving it into
 * `localStorage` and then redirecting to `/home` or `/onboarding`.
 */
export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user as unknown as User;

    const state = decodeOAuthState(req.query.state);
    if (state.ref) {
      try {
        await applyReferral(user, state.ref);
      } catch (err) {
        // Referral attribution is best-effort: never block login on failure.
        logger.warn({ err, userId: user.id }, 'Failed to apply referral');
      }
    }

    const token = issueJwt(user);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error({ err }, 'OAuth callback failed');
    res.redirect(`${env.FRONTEND_URL}/auth/error`);
  }
}

/**
 * `GET /api/auth/me` — returns the authenticated user's public profile.
 * Requires `requireAuth` to have run first.
 */
export async function handleGetMe(req: Request, res: Response): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });
    return;
  }

  const result = await mysqlDb.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!result[0]) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  res.json({ data: result[0] });
}

/**
 * `POST /api/auth/logout` — stateless. JWTs are bearer tokens and the
 * client is responsible for discarding them. This endpoint exists so the
 * frontend has a canonical URL to call; a future implementation can add
 * a Redis-backed JWT denylist without touching the client.
 */
export function handleLogout(_req: Request, res: Response): void {
  res.json({ data: { ok: true } });
}
