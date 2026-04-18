import type { Express } from 'express';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';

/**
 * Registers all API routes on the Express app.
 */
export function registerRoutes(app: Express): void {
  // OAuth authentication routes (login, callback, me, logout)
  app.use('/api/auth', authRouter);

  // AI generation routes (generate, regenerate, SSE events)
  app.use('/api', aiRoutes);

  // Session CRUD routes
  app.use('/api/sessions', sessionsRoutes);

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
