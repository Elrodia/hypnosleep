import { eq, sql, or } from 'drizzle-orm';
import { mysqlDb } from '../../db/mysql/client.js';
import { users } from '../../db/mysql/schema/users.js';
import { sessions } from '../../db/mysql/schema/sessions.js';
import { subscriptions } from '../../db/mysql/schema/subscriptions.js';
import { favorites } from '../../db/mysql/schema/favorites.js';
import { referrals } from '../../db/mysql/schema/referrals.js';
import { pgDb } from '../../db/postgres/client.js';
import { events } from '../../db/postgres/schema/events.js';
import { moodLogs } from '../../db/postgres/schema/mood-logs.js';
import { aiGenerations } from '../../db/postgres/schema/ai-generations.js';
import { streaks } from '../../db/postgres/schema/streaks.js';
import { weeklyInsights } from '../../db/postgres/schema/weekly-insights.js';
import { stripe } from '../subscription/stripe.client.js';
import { deleteFile, buildSessionKey } from '../audio/audio.s3.js';
import { notFound } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { UpdateProfileInput } from './profile.schema.js';

/**
 * Shape of the user-preferences JSON blob. Mirrors the `$type<...>`
 * on the `users.preferences` column so we can merge partial updates
 * without losing type information.
 */
type UserPreferences = {
  goals?: string[];
  preferredTime?: 'before_sleep' | 'morning' | 'breaks' | 'anytime';
  defaultDuration?: number;
  defaultVoice?: string;
  defaultBackground?: string;
  theme?: 'dark' | 'light';
  dailyReminderTime?: string;
};

/**
 * Public share URL template used for referral links. The frontend
 * extracts `?ref=...` to prefill the signup referral code.
 */
const REFERRAL_BASE_URL =
  process.env.REFERRAL_SHARE_BASE_URL ?? 'https://hypnosleep.app';

/**
 * Days of Pro granted per successful referral, used to compute the
 * `daysEarned` total surfaced on the referral screen. Kept as a
 * module constant so tests (and future tier changes) have a single
 * source of truth.
 */
const REFERRAL_REWARD_DAYS = 7;

/**
 * Loads the authenticated user's full MySQL row. Raises a typed
 * 404 `AppError` if the row is missing so callers don't need to
 * branch on `undefined`.
 */
export async function getProfile(userId: string) {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');
  return user;
}

/**
 * Applies a partial update to the user's row. `preferences` is
 * deep-merged with the existing value so callers can patch a single
 * key (e.g. `theme`) without dropping unrelated keys (`goals`,
 * `dailyReminderTime`, …). Returns the post-update user row.
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
  if (input.preferences) {
    const existing = (user.preferences ?? {}) as UserPreferences;
    updates.preferences = { ...existing, ...input.preferences };
  }

  if (Object.keys(updates).length === 0) return user;

  await mysqlDb.update(users).set(updates).where(eq(users.id, userId));
  const [updated] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return updated;
}

/**
 * Referral stats payload: the user's shareable code + URL, how many
 * friends they've invited, how many of those earned the reward, and
 * the cumulative days of Pro those rewards added up to.
 */
export async function getReferralStats(userId: string) {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  const [totals] = await mysqlDb
    .select({
      totalInvited: sql<number>`COUNT(*)`,
      rewardedCount: sql<number>`SUM(CASE WHEN ${referrals.rewardApplied} = TRUE THEN 1 ELSE 0 END)`,
    })
    .from(referrals)
    .where(eq(referrals.referrerId, userId));

  const totalInvited = Number(totals?.totalInvited ?? 0);
  const totalRewarded = Number(totals?.rewardedCount ?? 0);

  return {
    code: user.referralCode,
    shareUrl: `${REFERRAL_BASE_URL}/?ref=${user.referralCode}`,
    totalInvited,
    totalRewarded,
    daysEarned: totalRewarded * REFERRAL_REWARD_DAYS,
  };
}

/**
 * Full GDPR data export. Returns every row we hold for this user
 * across both databases as a single JSON-serializable object; the
 * controller wraps this in a download response with an
 * `application/json` content-disposition.
 */
export async function exportUserData(userId: string) {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  const [
    userSessions,
    userSubs,
    userFavs,
    userRefsAsReferrer,
    userRefsAsReferred,
    userEvents,
    userMoods,
    userGenerations,
    userStreak,
    userInsights,
  ] = await Promise.all([
    mysqlDb.select().from(sessions).where(eq(sessions.userId, userId)),
    mysqlDb.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    mysqlDb.select().from(favorites).where(eq(favorites.userId, userId)),
    mysqlDb.select().from(referrals).where(eq(referrals.referrerId, userId)),
    mysqlDb.select().from(referrals).where(eq(referrals.referredId, userId)),
    pgDb.select().from(events).where(eq(events.userId, userId)),
    pgDb.select().from(moodLogs).where(eq(moodLogs.userId, userId)),
    pgDb.select().from(aiGenerations).where(eq(aiGenerations.userId, userId)),
    pgDb.select().from(streaks).where(eq(streaks.userId, userId)),
    pgDb.select().from(weeklyInsights).where(eq(weeklyInsights.userId, userId)),
  ]);

  // Drop the oauth id from the export — it's an internal provider
  // identifier with no user-facing value and we'd rather not hand it
  // back in a downloadable file that gets forwarded in emails.
  const { oauthId: _oauthId, ...safeUser } = user;

  return {
    exportedAt: new Date().toISOString(),
    user: safeUser,
    sessions: userSessions,
    subscriptions: userSubs,
    favorites: userFavs,
    referrals: {
      asReferrer: userRefsAsReferrer,
      asReferred: userRefsAsReferred,
    },
    events: userEvents,
    moodLogs: userMoods,
    aiGenerations: userGenerations,
    streak: userStreak[0] ?? null,
    weeklyInsights: userInsights,
  };
}

/**
 * Deletes a user's account, irreversibly. Ordering matters:
 *
 *  1. Cancel the active Stripe subscription (if any) so billing
 *     stops immediately. Stripe errors are logged but swallowed —
 *     user data deletion must not be blocked by a third-party API.
 *  2. Delete every S3 audio object we own for the user.
 *  3. Delete Postgres analytics rows (events, mood logs, AI audit
 *     rows, streak, weekly insights).
 *  4. Delete the MySQL user row last; `ON DELETE CASCADE` cleans up
 *     sessions, subscriptions, favorites, usage counters, and
 *     referrals in the same statement.
 *
 * All failures after the Stripe step propagate — if the core DB
 * delete fails the caller must see an error, not a partial state.
 */
export async function deleteAccount(userId: string) {
  const [user] = await mysqlDb
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw notFound('User');

  // 1. Stripe cancellation — best effort.
  const [sub] = await mysqlDb
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (sub?.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } catch (err) {
      logger.warn(
        { err, userId },
        'Could not cancel Stripe subscription during account deletion',
      );
    }
  }

  // 2. S3 audio — best effort per file so one missing object doesn't
  // leave us unable to complete the DB delete.
  const userSessions = await mysqlDb
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  await Promise.all(
    userSessions.map((s) =>
      deleteFile(buildSessionKey(userId, s.id)).catch((err: unknown) => {
        logger.warn(
          { err, sessionId: s.id, userId },
          'S3 delete failed during account deletion',
        );
      }),
    ),
  );

  // 3. Postgres — no FKs to MySQL so we delete here first.
  await Promise.all([
    pgDb.delete(events).where(eq(events.userId, userId)),
    pgDb.delete(moodLogs).where(eq(moodLogs.userId, userId)),
    pgDb.delete(aiGenerations).where(eq(aiGenerations.userId, userId)),
    pgDb.delete(streaks).where(eq(streaks.userId, userId)),
    pgDb.delete(weeklyInsights).where(eq(weeklyInsights.userId, userId)),
  ]);

  // 4. Referrals — neither `referrerId` nor `referredId` cascade on
  // delete, so we must clear rows in both directions before the
  // user row goes away or MySQL will reject the delete with a
  // foreign-key error.
  await mysqlDb
    .delete(referrals)
    .where(
      or(
        eq(referrals.referrerId, userId),
        eq(referrals.referredId, userId),
      ),
    );

  // Also null out the `referredBy` back-reference on any *other*
  // user who was originally invited by this account — it's a plain
  // `varchar` without a FK but leaving a dangling id would be
  // misleading for downstream analytics.
  await mysqlDb
    .update(users)
    .set({ referredBy: null })
    .where(eq(users.referredBy, userId));

  // 5. MySQL user row — cascades to sessions, subscriptions,
  // favorites, and usage_counters.
  await mysqlDb.delete(users).where(eq(users.id, userId));

  logger.info({ userId }, 'Account deleted');
  return { ok: true };
}
