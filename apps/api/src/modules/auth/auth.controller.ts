import type { Request, Response } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mysqlDb } from '../../db/mysql/client.js';
import { getRedis } from '../../db/redis/client.js';
import { oauthTransactions } from '../../db/mysql/schema/oauth-transactions.js';
import { emailOtpTokens } from '../../db/mysql/schema/email-otp-tokens.js';
import { users, type User } from '../../db/mysql/schema/users.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { issueJwt, upsertUserFromOAuth } from './auth.service.js';
import { sendEmail } from '../../services/email.service.js';
import type { OAuthProvider, OAuthState } from './auth.types.js';

/**
 * Name of the HttpOnly cookie that pins the OAuth `state` nonce to the
 * user agent that initiated the login. Scoped to `/api/auth` so it is
 * never sent on any other API route.
 */
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_COOKIE_PATH = '/api/auth';
/** 10 minutes — plenty of time to round-trip through a provider. */
const OAUTH_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_STATE_TTL_SECONDS = OAUTH_STATE_COOKIE_MAX_AGE_MS / 1000;
const OAUTH_TX_REDIS_PREFIX = 'oauth:tx:';

interface RedisOAuthTx {
  nonce: string;
  ref?: string;
}

export type OAuthFailureReason =
  | 'state_missing'
  | 'state_mismatch'
  | 'provider_error'
  | 'email_provider_mismatch'
  | 'rate_limited'
  | 'initiation_failed'
  | 'callback_failed';

export function getOAuthRequestId(req: Request): string {
  const candidate = (req as Request & { id?: unknown }).id;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : randomUUID();
}

function getOAuthRequestMeta(req: Request): { origin: string | null; userAgent: string | null } {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
  return { origin, userAgent };
}

export function redirectOAuthError(
  res: Response,
  opts: { reason: OAuthFailureReason; rid: string },
): void {
  const redirectUrl = new URL('/auth/error', env.FRONTEND_URL);
  redirectUrl.searchParams.set('reason', opts.reason);
  redirectUrl.searchParams.set('rid', opts.rid);
  res.redirect(redirectUrl.toString());
}

export function logOAuthFailure(
  req: Request,
  opts: { provider: OAuthProvider; reason: OAuthFailureReason; rid: string; message: string },
): void {
  const meta = getOAuthRequestMeta(req);
  logger.warn(
    {
      provider: opts.provider,
      reason: opts.reason,
      rid: opts.rid,
      origin: meta.origin,
      'user-agent': meta.userAgent,
    },
    opts.message,
  );
}

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
function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function truncateIp(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter((p) => p.length > 0);
    return `${parts.slice(0, 4).join(':')}::`;
  }
  return ip;
}

export async function beginOAuthState(
  req: Request,
  res: Response,
  opts: { provider: OAuthProvider; ref?: string; pkceVerifier?: string },
): Promise<string> {
  const nonce = randomBytes(32).toString('base64url');
  const txId = randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + OAUTH_STATE_COOKIE_MAX_AGE_MS);
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].trim() : '';
  const ip = truncateIp(req.ip || '');

  let mysqlPersisted = false;
  try {
    await mysqlDb.insert(oauthTransactions).values({
      id: txId,
      provider: opts.provider,
      stateNonce: nonce,
      pkceVerifier: opts.pkceVerifier ?? null,
      referralCode: opts.ref ?? null,
      userAgentHash: userAgent ? sha256Hex(userAgent) : null,
      ipHash: ip ? sha256Hex(ip) : null,
      expiresAt,
    });
    mysqlPersisted = true;
  } catch (err) {
    logger.warn({ err, txId }, 'Failed to persist OAuth transaction in MySQL; attempting Redis fallback');
  }

  let redisPersisted = false;
  if (env.REDIS_URL) {
    const redis = getRedis();
    if (redis) {
      try {
        const payload: RedisOAuthTx = {
          nonce,
          ...(opts.ref ? { ref: opts.ref } : {}),
        };
        await redis.set(
          `${OAUTH_TX_REDIS_PREFIX}${txId}`,
          JSON.stringify(payload),
          'EX',
          OAUTH_STATE_TTL_SECONDS,
        );
        redisPersisted = true;
      } catch (err) {
        if (!mysqlPersisted) {
          logger.warn({ err, txId }, 'Failed to persist OAuth transaction in Redis fallback');
          throw err;
        }
        logger.warn({ err, txId }, 'Failed to cache OAuth transaction in Redis; using DB fallback');
      }
    }
  }

  if (!mysqlPersisted && !redisPersisted) {
    throw new Error('Unable to persist OAuth transaction');
  }

  res.cookie(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax', // must be 'lax' so the cookie survives the provider's cross-site redirect back
    secure: env.NODE_ENV === 'production',
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_COOKIE_MAX_AGE_MS,
  });

  return Buffer.from(JSON.stringify({ tx: txId, nonce } satisfies OAuthState)).toString('base64url');
}

/** Best-effort decode of `state`. Malformed values are silently ignored. */
export function decodeOAuthState(raw: unknown): OAuthState | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString()) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const nonce = (parsed as { nonce?: unknown }).nonce;
    const tx = (parsed as { tx?: unknown }).tx;
    if (typeof nonce !== 'string' || nonce.length === 0) return null;
    if (typeof tx !== 'string' || tx.length === 0) return null;
    return { nonce, tx };
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
function getAffectedRows(result: unknown): number {
  if (typeof result !== 'object' || !result) return 0;
  const affectedRows = (result as { affectedRows?: unknown }).affectedRows;
  return typeof affectedRows === 'number' ? affectedRows : 0;
}

export async function consumeOAuthState(
  req: Request,
  res: Response,
): Promise<{ state: OAuthState | null; reason: OAuthFailureReason | null }> {
  const cookieNonce = readCookie(req, OAUTH_STATE_COOKIE);
  // Always clear the cookie — it's single-use regardless of outcome.
  res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_COOKIE_PATH });

  const state = decodeOAuthState(req.query.state);
  if (!state) return { state: null, reason: 'state_missing' };
  if (!cookieNonce) return { state: null, reason: 'state_missing' };
  if (!safeEqual(cookieNonce, state.nonce)) {
    return { state: null, reason: 'state_mismatch' };
  }

  const now = new Date();
  const updateResult = await mysqlDb
    .update(oauthTransactions)
    .set({ consumedAt: now })
    .where(
      and(
        eq(oauthTransactions.id, state.tx),
        eq(oauthTransactions.stateNonce, state.nonce),
        isNull(oauthTransactions.consumedAt),
        gt(oauthTransactions.expiresAt, now),
      ),
    );

  if (getAffectedRows(updateResult) !== 1) {
    if (env.REDIS_URL) {
      const redis = getRedis();
      if (redis) {
        try {
          const key = `${OAUTH_TX_REDIS_PREFIX}${state.tx}`;
          const raw = await redis.eval(
            "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value;",
            1,
            key,
          );
          if (typeof raw === 'string') {
            const parsed = JSON.parse(raw) as RedisOAuthTx;
            if (parsed?.nonce && safeEqual(parsed.nonce, state.nonce)) {
              return {
                state: { ...state, ...(parsed.ref ? { ref: parsed.ref } : {}) },
                reason: null,
              };
            }
          }
        } catch (err) {
          logger.warn({ err, txId: state.tx }, 'Redis consume for OAuth transaction failed; using DB result');
        }
      }
    }
    return { state: null, reason: 'state_mismatch' };
  }

  const rows = await mysqlDb
    .select({ referralCode: oauthTransactions.referralCode })
    .from(oauthTransactions)
    .where(eq(oauthTransactions.id, state.tx))
    .limit(1);
  const ref = rows[0]?.referralCode ?? undefined;

  if (env.REDIS_URL) {
    const redis = getRedis();
    if (redis) {
      void redis.del(`${OAUTH_TX_REDIS_PREFIX}${state.tx}`).catch((err) => {
        logger.warn({ err, txId: state.tx }, 'Failed to delete consumed OAuth transaction from Redis');
      });
    }
  }

  return { state: { ...state, ...(ref ? { ref } : {}) }, reason: null };
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
  const provider = req.path.includes('/github')
    ? 'github'
    : req.path.includes('/microsoft')
      ? 'microsoft'
      : 'google';
  const rid = getOAuthRequestId(req);
  try {
    const { state, reason } = await consumeOAuthState(req, res);
    if (!state || reason) {
      logOAuthFailure(req, {
        provider,
        reason: reason ?? 'state_missing',
        rid,
        message: 'OAuth callback rejected: missing or invalid state nonce',
      });
      redirectOAuthError(res, { reason: reason ?? 'state_missing', rid });
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
    logOAuthFailure(req, {
      provider,
      reason: 'callback_failed',
      rid,
      message: 'OAuth callback failed',
    });
    logger.error({ err, provider, rid }, 'OAuth callback failure details');
    redirectOAuthError(res, { reason: 'callback_failed', rid });
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

// ─────────────────────────────────────────────────────────────────────────────
// Email OTP (passwordless) authentication
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_OTP_DIGITS = 6;

/** Generate a zero-padded 6-digit OTP string (e.g. "042817"). */
function generateOtp(): string {
  const max = Math.pow(10, EMAIL_OTP_DIGITS);
  const code = randomBytes(4).readUInt32BE(0) % max;
  return String(code).padStart(EMAIL_OTP_DIGITS, '0');
}

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * `POST /api/auth/email/send` — generate a one-time code and email it.
 *
 * Body: `{ email: string }`
 *
 * Rate-limited upstream. Responds with `{ data: { ok: true } }` whether
 * or not the address exists so we do not leak account existence.
 */
export async function handleEmailOtpSend(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' } });
    return;
  }

  const otp = generateOtp();
  const tokenHash = hashOtp(otp);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  try {
    await mysqlDb.insert(emailOtpTokens).values({ id, email, tokenHash, expiresAt });
  } catch (err) {
    logger.error({ err, email }, 'Failed to persist email OTP token');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Could not initiate sign-in. Please try again.' } });
    return;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="margin-bottom:8px">Your HypnoSleep sign-in code</h2>
      <p style="color:#555">Use the code below to complete your sign-in. It expires in 10 minutes and can only be used once.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:24px 0;color:#111">${otp}</div>
      <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject: `${otp} is your HypnoSleep sign-in code`,
      html,
      text: `Your HypnoSleep sign-in code is: ${otp}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`,
    });
  } catch (err) {
    logger.error({ err, email }, 'Failed to send OTP email');
    // Still return success to avoid leaking whether delivery failed for
    // this address vs. a non-existent one.
  }

  res.json({ data: { ok: true } });
}

/**
 * `POST /api/auth/email/verify` — validate OTP, upsert user, issue JWT.
 *
 * Body: `{ email: string; otp: string }`
 *
 * On success returns `{ data: { token: string } }` — the same JWT shape
 * used by the OAuth callback so the frontend can store and use it
 * identically.
 */
export async function handleEmailOtpVerify(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

  if (!email || !otp) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and OTP are required.' } });
    return;
  }

  const tokenHash = hashOtp(otp);
  const now = new Date();

  // Find a matching, unexpired, unused token.
  const rows = await mysqlDb
    .select()
    .from(emailOtpTokens)
    .where(
      and(
        eq(emailOtpTokens.tokenHash, tokenHash),
        eq(emailOtpTokens.email, email),
        isNull(emailOtpTokens.usedAt),
        gt(emailOtpTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!rows[0]) {
    res
      .status(401)
      .json({ error: { code: 'INVALID_OTP', message: 'The code is incorrect, expired, or has already been used.' } });
    return;
  }

  // Mark as used (single-use).
  await mysqlDb
    .update(emailOtpTokens)
    .set({ usedAt: now })
    .where(eq(emailOtpTokens.id, rows[0].id));

  let user: User;
  try {
    // Use the email address as both the provider-scoped ID and display name
    // on first sign-in. Name can be updated via the profile endpoint.
    user = await upsertUserFromOAuth({
      provider: 'email',
      providerId: email,
      email,
      name: email.split('@')[0] ?? email,
      avatarUrl: undefined,
    });
  } catch (err) {
    const errObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
    if (typeof errObj.code === 'string' && errObj.code === 'EMAIL_PROVIDER_MISMATCH') {
      res
        .status(409)
        .json({ error: { code: 'EMAIL_PROVIDER_MISMATCH', message: String(errObj.message ?? 'This email is already linked to a different sign-in provider.') } });
      return;
    }
    logger.error({ err, email }, 'Failed to upsert email-auth user');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Sign-in failed. Please try again.' } });
    return;
  }

  const token = issueJwt(user);
  res.json({ data: { token } });
}

