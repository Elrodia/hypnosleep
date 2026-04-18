import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mysqlDb } from '../../db/mysql/client.js';
import { users, type User } from '../../db/mysql/schema/users.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { issueJwt } from './auth.service.js';
import type { OAuthState } from './auth.types.js';

/**
 * Name of the HttpOnly cookie that pins the OAuth `state` nonce to the
 * user agent that initiated the login. Scoped to `/api/auth` so it is
 * never sent on any other API route.
 */
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_COOKIE_PATH = '/api/auth';
/** 10 minutes — plenty of time to round-trip through a provider. */
const OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Begin an OAuth flow: generate a cryptographically random nonce, pin
 * it to this user agent via an HttpOnly cookie, and return the
 * base64url-encoded `state` blob (containing the nonce and optional
 * referral code) to hand off to the provider.
 *
 * The nonce in the state is later compared against the cookie in
 * {@link consumeOAuthState} so that an attacker cannot complete an
 * OAuth handshake in one browser and trick a victim into landing on
 * the callback URL in another (login CSRF / token injection).
 */
export function beginOAuthState(res: Response, opts: { ref?: string }): string {
  const nonce = randomBytes(32).toString('base64url');
  const state: OAuthState = { nonce };
  if (opts.ref) state.ref = opts.ref;

  res.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax', // must be 'lax' so the cookie survives the provider's cross-site redirect back
    secure: env.NODE_ENV === 'production',
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_MS,
  });

  return Buffer.from(JSON.stringify(state)).toString('base64url');
}

/** Best-effort decode of `state`. Malformed values are silently ignored. */
export function decodeOAuthState(raw: unknown): OAuthState | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString()) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const nonce = (parsed as { nonce?: unknown }).nonce;
    if (typeof nonce !== 'string' || nonce.length === 0) return null;
    const ref = (parsed as { ref?: unknown }).ref;
    return {
      nonce,
      ...(typeof ref === 'string' && ref.length > 0 ? { ref } : {}),
    };
  } catch {
    return null;
  }
}

/** Pull a named cookie out of the raw `Cookie` header without a parser dep. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding — treat as if the cookie weren't present
      // rather than crashing the callback handler.
      return undefined;
    }
  }
  return undefined;
}

/** Constant-time string compare that also guards against length mismatches. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Validate the OAuth `state` against the pinned cookie and, if valid,
 * clear the cookie and return the decoded state. Returns `null` (and
 * still clears the cookie) on any mismatch so the caller can redirect
 * to the error page without issuing a JWT.
 */
export function consumeOAuthState(req: Request, res: Response): OAuthState | null {
  const cookieNonce = readCookie(req, OAUTH_STATE_COOKIE);
  // Always clear the cookie — it's single-use regardless of outcome.
  res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_COOKIE_PATH });

  const state = decodeOAuthState(req.query.state);
  if (!state || !cookieNonce) return null;
  if (!safeEqual(cookieNonce, state.nonce)) return null;
  return state;
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
 * Final step of an OAuth callback: validate the CSRF nonce in `state`
 * against the pinned cookie, maybe apply a referral code, issue a JWT,
 * and redirect back to the frontend's callback page with the token in
 * the query string. The frontend is responsible for moving it into
 * `localStorage` and then redirecting to `/home` or `/onboarding`.
 */
export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const state = consumeOAuthState(req, res);
    if (!state) {
      logger.warn('OAuth callback rejected: missing or invalid state nonce');
      res.redirect(`${env.FRONTEND_URL}/auth/error`);
      return;
    }

    const user = req.user as unknown as User;

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
 *
 * The response is an explicit whitelist: provider identifiers
 * (`oauthProvider`, `oauthId`) and internal timestamps are intentionally
 * omitted so they never leak to the client.
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

  const u = result[0];
  res.json({
    data: {
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      plan: u.plan,
      preferences: u.preferences,
      referralCode: u.referralCode,
      referredBy: u.referredBy,
      createdAt: u.createdAt,
    },
  });
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
