import crypto from 'node:crypto';
import jsonwebtoken, { type SignOptions } from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import { mysqlDb } from '../../db/mysql/client.js';
import { users, type User } from '../../db/mysql/schema/users.js';
import { pgDb } from '../../db/postgres/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { JwtPayload, OAuthProfile } from './auth.types.js';

const { sign, verify } = jsonwebtoken;

/** Length of the human-shareable referral code we mint on signup. */
const REFERRAL_CODE_LENGTH = 10;

/**
 * Generate a referral code that is uppercase alphanumeric and easy to
 * share verbally. `nanoid` occasionally produces `-` or `_` (URL-safe
 * characters that don't survive voice / hand-writing); we swap those for
 * `A` so the output stays A–Z0–9 only.
 */
function generateReferralCode(): string {
  return nanoid(REFERRAL_CODE_LENGTH).replace(/[-_]/g, 'A').toUpperCase();
}

/**
 * Track a `signup` event in the analytics store. Intentionally
 * fire-and-forget: a failing event write must never block a login flow.
 */
function trackSignupEvent(userId: string, provider: OAuthProfile['provider']): void {
  void pgDb
    .insert(events)
    .values({
      userId,
      eventType: 'signup',
      metadata: { provider },
    })
    .catch((err: unknown) => {
      logger.error({ err, userId }, 'Failed to track signup event');
    });
}

/**
 * Find or create a user from an OAuth profile.
 *
 * Resolution order:
 * 1. Match by (oauthProvider, oauthId) — the same provider login.
 * 2. If not found, check whether the email is already registered under a
 *    different provider and throw `EMAIL_PROVIDER_MISMATCH` (HTTP 409).
 * 3. Otherwise, create a new user and emit a `signup` event.
 *
 * On existing users, name/avatar are refreshed to keep them in sync with
 * the provider. A first-time signup emits a `signup` event in PostgreSQL.
 */
export async function upsertUserFromOAuth(profile: OAuthProfile): Promise<User> {
  // 1. Match by provider + providerId
  const existing = await mysqlDb
    .select()
    .from(users)
    .where(
      and(
        eq(users.oauthProvider, profile.provider),
        eq(users.oauthId, profile.providerId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    // Refresh name/avatar so stale data doesn't linger.
    await mysqlDb
      .update(users)
      .set({ name: profile.name, avatarUrl: profile.avatarUrl ?? null })
      .where(eq(users.id, existing[0].id));
    return {
      ...existing[0],
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
    };
  }

  // 2. Check for email collision with a different provider
  const byEmail = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (byEmail[0]) {
    throw new AppError(
      'EMAIL_PROVIDER_MISMATCH',
      `This email is registered with ${byEmail[0].oauthProvider}. Please log in with that provider.`,
      409,
      { provider: byEmail[0].oauthProvider },
    );
  }

  // 3. Create new user
  const now = new Date();
  const newUser = {
    id: crypto.randomUUID(),
    oauthProvider: profile.provider,
    oauthId: profile.providerId,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? null,
    plan: 'free' as const,
    preferences: null,
    referralCode: generateReferralCode(),
    referredBy: null,
  };

  await mysqlDb.insert(users).values(newUser);

  trackSignupEvent(newUser.id, profile.provider);

  return {
    ...newUser,
    createdAt: now,
    updatedAt: now,
  } as User;
}

/**
 * Issue a signed JWT for the given user. Encodes the `userId` and
 * `plan` so downstream middleware can authorize without a DB lookup.
 * Expiry is controlled by `JWT_EXPIRES_IN`.
 */
export function issueJwt(user: Pick<User, 'id' | 'plan'>): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return sign({ userId: user.id, plan: user.plan }, env.JWT_SECRET, options);
}

/**
 * Verify and decode a JWT. Throws the underlying `jsonwebtoken` error
 * (e.g. `TokenExpiredError`, `JsonWebTokenError`) when the token is
 * invalid or expired — callers are expected to translate that into an
 * HTTP 401 response.
 */
export function verifyJwt(token: string): JwtPayload {
  return verify(token, env.JWT_SECRET) as JwtPayload;
}
