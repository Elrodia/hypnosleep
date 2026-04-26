import type { Express } from 'express';
import passport from 'passport';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { subscriptionRouter } from './modules/subscription/subscription.routes.js';
import { progressRouter } from './modules/progress/progress.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { kvRouter } from './modules/kv/kv.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { adminDebugRouter } from './modules/admin/debug.routes.js';
import { authenticate } from './middleware/authenticate.js';
import { env, validateAuthRuntimeConfig } from './config/env.js';
import { getDebugLogHealth } from './services/debug-log.service.js';
import {
  detectMissingCoreTables,
  REQUIRED_MYSQL_TABLES,
} from './db/mysql/schema-check.js';
import { mysqlSchemaProbe } from './db/mysql/schema-probe.js';
import { logger } from './utils/logger.js';

// Compute auth runtime diagnostics once at module load. `env` is static
// for the process lifetime, so re-parsing `API_URL` / Railway domains on
// every request would be wasteful and could drift from the values that
// were validated and logged at startup.
const authRuntimeDiagnostics = validateAuthRuntimeConfig(env);

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

  // Per-user key/value store used by the frontend to persist UI state
  // (onboarding flags, preferences, cached stats) across devices. Backed
  // by Redis; keys are namespaced per authenticated user.
  app.use('/api/kv', kvRouter);

  // Per-user notifications inbox (in-app bell). Backed by Redis with a
  // capped per-user list so it cannot grow unbounded.
  app.use('/api/notifications', notificationsRouter);

  // Admin-only diagnostic endpoints: debug event lookup by rid,
  // filtered listing, JSONL export, health. Gated at the router level
  // by `requireAuth` → `requireAdmin`.
  app.use('/api/admin/debug', adminDebugRouter);

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

  // Unauthenticated liveness endpoint for the debug-log subsystem.
  // Returns a coarse status so an uptime monitor can alert when
  // persistence regresses, without leaking any event details.
  app.get('/api/health/debug', (_req, res) => {
    const h = getDebugLogHealth();
    // Only flip to `degraded` once we've observed at least one write
    // AND the most recent one failed. A cold instance with zero
    // writes yet is reported as `ok` (nothing broken, just no data).
    const writesObserved = h.totalWrites > 0;
    const lastWriteFailing = Boolean(h.lastWriteError);
    res.json({
      data: {
        status: writesObserved && lastWriteFailing ? 'degraded' : 'ok',
        lastWriteAt: h.lastWriteAt,
        lastWriteDurationMs: h.lastWriteDurationMs,
        totalWrites: h.totalWrites,
        totalFailures: h.totalFailures,
        lastPruneAt: h.lastPruneAt,
        lastPruneDeleted: h.lastPruneDeleted,
        retentionDays: env.DEBUG_LOG_RETENTION_DAYS,
      },
    });
  });

  // Protected diagnostic endpoint for OAuth/public auth runtime config.
  app.get('/api/health/auth-config', authenticate(), (_req, res) => {
    res.json({
      data: {
        nodeEnv: authRuntimeDiagnostics.nodeEnv,
        secureCookie: authRuntimeDiagnostics.secureCookie,
        callbackUrls: authRuntimeDiagnostics.callbackUrls,
      },
    });
  });

  // Unauthenticated sibling of `/api/health/auth-config` that exposes
  // ONLY the derived OAuth callback URLs and public origins. No
  // secrets, no tokens, no user data. This is intentionally unguarded
  // because OAuth sign-in is the very mechanism the operator would
  // need to authenticate with — and when sign-in is broken (the exact
  // failure mode this endpoint exists to diagnose), requiring auth to
  // read the callback URLs defeats the purpose. The values returned
  // here are already public-by-design: the provider consoles record
  // them, and the browser's OAuth redirect URLs carry them on every
  // sign-in attempt.
  //
  // Use this endpoint to verify the URLs registered in Google Cloud
  // Console, GitHub Developers, and Microsoft Entra exactly match the
  // `callbackUrls` this deployment builds from `API_URL`.
  app.get('/api/health/oauth-callbacks', (_req, res) => {
    res.json({
      data: {
        apiOrigin: authRuntimeDiagnostics.apiOrigin,
        frontendOrigin: authRuntimeDiagnostics.frontendOrigin,
        callbackUrls: authRuntimeDiagnostics.callbackUrls,
      },
    });
  });

  // Unauthenticated schema probe. Reports whether the required core
  // MySQL tables exist on THIS deployment. Intentionally public for the
  // same reason `/api/health/oauth-callbacks` is: when the release-time
  // migration step silently skips and `oauth_transactions` is missing,
  // sign-in is broken end-to-end — so requiring authentication to find
  // out "what's broken" would defeat the point.
  //
  // Returns NO connection string, NO credentials, NO row counts, NO
  // server version — only table names (which are already encoded in
  // the SQL migration files committed to the repo, so they are not
  // sensitive). `status` is `ok` iff every required table is present.
  app.get('/api/health/database', async (_req, res) => {
    try {
      const missing = await detectMissingCoreTables(mysqlSchemaProbe);
      res.json({
        data: {
          status: missing.length === 0 ? 'ok' : 'missing_tables',
          requiredTables: REQUIRED_MYSQL_TABLES,
          missingTables: missing.map((m) => m.table),
        },
      });
    } catch (err) {
      // A failing probe is a connectivity problem, not a schema problem.
      // Report it separately so the two modes don't get confused.
      logger.warn({ err }, 'GET /api/health/database: schema probe failed');
      res.status(503).json({
        data: {
          status: 'probe_failed',
          requiredTables: REQUIRED_MYSQL_TABLES,
        },
      });
    }
  });
}
