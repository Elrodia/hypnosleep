import type { Express } from 'express';
import passport from 'passport';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';

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

  // Session CRUD routes (registered BEFORE the AI router so the
  // sessions module owns POST /sessions/generate and GET
  // /sessions/:id/events; the AI router still handles
  // /sessions/:id/regenerate-paragraph).
  app.use('/api/sessions', sessionsRoutes);

  // AI generation routes (regenerate paragraph, etc.)
  app.use('/api', aiRoutes);

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
