import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../../config/env.js';
import { upsertUserFromOAuth } from '../auth.service.js';

/**
 * Passport strategy for "Continue with Google".
 *
 * Google returns `profile.emails[0].value` when the `email` scope is
 * granted; we require it and fail the login otherwise so we never end up
 * with an account lacking a primary email.
 */
export const googleStrategy = new GoogleStrategy(
  {
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${env.API_URL}/api/auth/google/callback`,
    scope: ['profile', 'email'],
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        done(new Error('No email returned from Google'));
        return;
      }

      const user = await upsertUserFromOAuth({
        provider: 'google',
        providerId: profile.id,
        email,
        name: profile.displayName || email,
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  },
);
