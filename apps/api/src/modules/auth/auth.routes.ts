import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import { logger } from '../../utils/logger.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { googleStrategy } from './strategies/google.strategy.js';
import { githubStrategy } from './strategies/github.strategy.js';
import { microsoftStrategy } from './strategies/microsoft.strategy.js';
import { requireAuth } from './auth.middleware.js';
import {
  beginOAuthState,
  consumeOAuthState,
  getOAuthRequestId,
  handleGetMe,
  handleLogout,
  handleOAuthCallback,
  logOAuthFailure,
  redirectOAuthError,
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
 * Build the OAuth initiation handler for a given provider. Generates a
 * CSRF nonce (pinned to the user agent via an HttpOnly cookie) and
 * packs it — along with an optional `?ref=CODE` — into the OAuth
 * `state` parameter so both survive the provider redirect.
 *
 * The handler is `async` (it awaits a MySQL write to persist the OAuth
 * transaction) but Express 4 does not forward promise rejections from
 * route handlers to `next(err)`. Without the explicit try/catch below,
 * any failure in `beginOAuthState` — a transient DB blip, a Redis write
 * timeout surfaced as a throw, etc. — would become an unhandled
 * rejection and the request would hang forever, leaving the browser
 * stuck on an endless loading screen after the user clicks
 * "Continue with <Provider>". Catch, log, and redirect to the frontend
 * error page instead.
 */
function initOAuth(provider: OAuthProvider) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rid = getOAuthRequestId(req);
    try {
      const ref = typeof req.query.ref === 'string' ? req.query.ref : undefined;
      const state = await beginOAuthState(req, res, { provider, ref });
      passport.authenticate(provider, { session: false, state })(req, res, next);
    } catch (err) {
      logOAuthFailure(req, {
        provider,
        reason: 'initiation_failed',
        rid,
        message: 'OAuth initiation failed',
      });
      logger.error({ err, provider, rid }, 'OAuth initiation failure details');
      if (!res.headersSent) {
        redirectOAuthError(res, { reason: 'initiation_failed', rid });
      }
    }
  };
}

/**
 * Build the OAuth callback chain: authenticate via passport (which
 * triggers the upsert), then hand off to the shared callback controller
 * that validates the CSRF state, attaches referrals, issues a JWT and
 * redirects to the frontend.
 *
 * We use a custom `passport.authenticate` callback so that *any*
 * failure — whether an expected `done(null, false)` or an error thrown
 * by the strategy (e.g. `EMAIL_PROVIDER_MISMATCH`) — redirects the
 * browser back to the frontend error page. The default `failureRedirect`
 * option only handles the former and would otherwise surface thrown
 * errors as JSON through the global error handler, breaking the browser
 * OAuth flow.
 */
function callbackHandlers(provider: OAuthProvider) {
  return [
    (req: Request, res: Response, next: NextFunction): void => {
      passport.authenticate(
        provider,
        { session: false },
        (err: unknown, user: Express.User | false | null) => {
          void (async () => {
            if (err || !user) {
              const rid = getOAuthRequestId(req);
              const reason =
                typeof err === 'object' &&
                err &&
                'message' in err &&
                typeof err.message === 'string' &&
                err.message.includes('EMAIL_PROVIDER_MISMATCH')
                  ? 'email_provider_mismatch'
                  : 'provider_error';
              logOAuthFailure(req, {
                provider,
                reason,
                rid,
                message: 'OAuth authentication failed',
              });
              if (err) {
                const errName =
                  typeof err === 'object' && err && 'name' in err && typeof err.name === 'string'
                    ? err.name
                    : 'OAuthError';
                logger.warn({ provider, rid, errName }, 'OAuth provider returned an error');
              }

              try {
                await consumeOAuthState(req, res);
              } catch {
                // Cleanup is best-effort in provider failure path.
              }

              redirectOAuthError(res, { reason, rid });
              return;
            }

            req.user = user;
            next();
          })();
        },
      )(req, res, next);
    },
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
