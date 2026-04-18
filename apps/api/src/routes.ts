import type { Express } from 'express';
import passport from 'passport';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { subscriptionRouter } from './modules/subscription/subscription.routes.js';
import { progressRouter } from './modules/progress/progress.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';

/**
 * Registers all API routes on the Express app.
 */
export function registerRoutes(app: Express): void {
  // Passport has to be initialized before any `passport.authenticate()` call
  // runs so that its request helpers (e.g. `req.login`, `req.logout`) are
  // attached. We don't use server sessions — bearer JWTs only — so only
  // `passport.initialize()` is needed here.
  app.use(passport.initialize());

  // OAuth authentication routes (login, callback, me, logout)
  app.use('/api/auth', authRouter);

  // Stripe subscription routes. The webhook handler inside this router
  // owns raw-body parsing for `/api/subscription/webhook`; the
  // `server.ts` JSON parser skips that path so signature verification
  // sees unmodified bytes.
  app.use('/api/subscription', subscriptionRouter);

  // Session CRUD routes (registered BEFORE the AI router so the
  // sessions module owns POST /sessions/generate and GET
  // /sessions/:id/events; the AI router still handles
  // /sessions/:id/regenerate-paragraph).
  app.use('/api/sessions', sessionsRoutes);

  // AI generation routes (regenerate paragraph, etc.)
  app.use('/api', aiRoutes);

  // Progress tracking (mood logs, streaks, heatmap, weekly AI insight).
  app.use('/api/progress', progressRouter);

  // Profile management (preferences, referral stats, GDPR export,
  // account deletion).
  app.use('/api/profile', profileRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? '1.0.0',
      },
    });
  });
}
