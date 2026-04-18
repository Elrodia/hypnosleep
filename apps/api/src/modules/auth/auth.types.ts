import type { Plan } from '../../config/constants.js';

/** Supported OAuth providers. Passwordless — we support no other auth methods. */
export type OAuthProvider = 'google' | 'github' | 'microsoft';

/**
 * Normalized profile returned by each OAuth strategy after unwrapping the
 * provider's specific response shape. This is the only shape the auth
 * service cares about.
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

/** Decoded payload attached to a JWT we issue. */
export interface JwtPayload {
  userId: string;
  plan: Plan;
  iat: number;
  exp: number;
}

/**
 * Optional OAuth `state` blob. Carries a cryptographically random
 * `nonce` used for CSRF protection (bound to the user agent via an
 * HttpOnly cookie and validated in the callback) and optionally a
 * referral code so new users can be attributed to the referrer that
 * sent them.
 */
export interface OAuthState {
  nonce: string;
  ref?: string;
}
