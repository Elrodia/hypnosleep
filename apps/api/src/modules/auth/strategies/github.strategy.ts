import { Strategy as GitHubStrategy } from 'passport-github2';
import { env } from '../../../config/env.js';
import { upsertUserFromOAuth } from '../auth.service.js';

/**
 * Passport strategy for "Continue with GitHub".
 *
 * The `user:email` scope is requested so we can see the user's primary
 * email even when it is set to private on their GitHub profile. If the
 * profile still doesn't include an email, the login fails rather than
 * creating an email-less account.
 */
export const githubStrategy = new GitHubStrategy(
  {
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: `${env.API_URL}/api/auth/github/callback`,
    scope: ['user:email'],
  },
  async (
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string | number;
      displayName?: string;
      username?: string;
      emails?: { value: string }[];
      photos?: { value: string }[];
    },
    done: (err: Error | null, user?: unknown) => void,
  ) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        done(
          new Error(
            'No email returned from GitHub. Make sure your email is public or the user:email scope is granted.',
          ),
        );
        return;
      }

      const user = await upsertUserFromOAuth({
        provider: 'github',
        providerId: String(profile.id),
        email,
        name: profile.displayName || profile.username || email,
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  },
);
