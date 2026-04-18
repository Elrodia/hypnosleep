// `passport-microsoft` ships without TypeScript declarations, so we
// deliberately type the imported strategy ourselves. A dedicated
// `require`-style import keeps the module boundaries clean.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no @types/passport-microsoft is published
import MicrosoftPassport from 'passport-microsoft';
import { env } from '../../../config/env.js';
import { upsertUserFromOAuth } from '../auth.service.js';

interface MicrosoftProfile {
  id: string;
  displayName?: string;
  emails?: { value: string }[];
  _json?: {
    mail?: string;
    userPrincipalName?: string;
  };
}

type StrategyCtor = new (
  options: {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
    tenant?: string;
  },
  verify: (
    accessToken: string,
    refreshToken: string,
    profile: MicrosoftProfile,
    done: (err: Error | null, user?: unknown) => void,
  ) => void,
) => unknown;

const { Strategy: MicrosoftStrategy } = MicrosoftPassport as { Strategy: StrategyCtor };

/**
 * Passport strategy for "Continue with Microsoft".
 *
 * Microsoft Graph exposes the user's primary address via `mail` or —
 * when `mail` is unset — via `userPrincipalName`. We consult both before
 * giving up, because many Azure AD / Entra accounts only populate one.
 * Avatar fetching is skipped: Graph requires an additional authenticated
 * call to `/me/photo/$value`, which isn't worth the complexity at signup.
 */
export const microsoftStrategy = new MicrosoftStrategy(
  {
    clientID: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET,
    callbackURL: `${env.API_URL}/api/auth/microsoft/callback`,
    scope: ['user.read'],
    tenant: env.MICROSOFT_TENANT_ID,
  },
  async (
    _accessToken: string,
    _refreshToken: string,
    profile: MicrosoftProfile,
    done: (err: Error | null, user?: unknown) => void,
  ) => {
    try {
      const email =
        profile.emails?.[0]?.value ??
        profile._json?.mail ??
        profile._json?.userPrincipalName;

      if (!email) {
        done(new Error('No email returned from Microsoft'));
        return;
      }

      const user = await upsertUserFromOAuth({
        provider: 'microsoft',
        providerId: profile.id,
        email,
        name: profile.displayName || email,
        avatarUrl: undefined,
      });
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  },
);
