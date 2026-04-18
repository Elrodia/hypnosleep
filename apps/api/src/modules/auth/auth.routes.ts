import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { googleStrategy } from './strategies/google.strategy.js';
import { githubStrategy } from './strategies/github.strategy.js';
import { microsoftStrategy } from './strategies/microsoft.strategy.js';
import { requireAuth } from './auth.middleware.js';
import {
  encodeOAuthState,
  handleGetMe,
  handleLogout,
  handleOAuthCallback,
} from './auth.controller.js';
import type { OAuthProvider } from './auth.types.js';

// Register passport strategies once at module import time.
passport.use('google', googleStrategy);
// passport-github2's typings don't line up with passport 0.7's Strategy
// interface, so we assert through `unknown` to keep this registration
// compile-clean without loosening the global passport typings.
passport.use('github', githubStrategy as unknown as passport.Strategy);
passport.use('microsoft', microsoftStrategy as unknown as passport.Strategy);

/**
 * Build the OAuth initiation handler for a given provider. The optional
 * `?ref=CODE` query string is packed into the OAuth `state` parameter so
 * the referral is preserved across the provider redirect.
 */
function initOAuth(provider: OAuthProvider) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ref = typeof req.query.ref === 'string' ? req.query.ref : undefined;
    const state = encodeOAuthState({ ref });
    passport.authenticate(provider, { session: false, state })(req, res, next);
  };
}

/**
 * Build the OAuth callback chain: authenticate via passport (which
 * triggers the upsert), then hand off to the shared callback controller
 * that attaches referrals, issues a JWT and redirects to the frontend.
 */
function callbackHandlers(provider: OAuthProvider) {
  return [
    passport.authenticate(provider, {
      session: false,
      failureRedirect: `${env.FRONTEND_URL}/auth/error`,
    }),
    handleOAuthCallback,
  ] as const;
}

export const authRouter = Router();

const authRateLimit = rateLimit(RATE_LIMITS.AUTH.window, RATE_LIMITS.AUTH.max);

// --- OAuth initiation ----------------------------------------------------
authRouter.get('/google', authRateLimit, initOAuth('google'));
authRouter.get('/github', authRateLimit, initOAuth('github'));
authRouter.get('/microsoft', authRateLimit, initOAuth('microsoft'));

// --- OAuth callbacks -----------------------------------------------------
authRouter.get('/google/callback', authRateLimit, ...callbackHandlers('google'));
authRouter.get('/github/callback', authRateLimit, ...callbackHandlers('github'));
authRouter.get('/microsoft/callback', authRateLimit, ...callbackHandlers('microsoft'));

// --- Session helpers -----------------------------------------------------
authRouter.get('/me', authRateLimit, requireAuth, handleGetMe);
authRouter.post('/logout', authRateLimit, requireAuth, handleLogout);
