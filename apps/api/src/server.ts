import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { ipRateLimit } from './middleware/rate-limit.js';
import { registerRoutes } from './routes.js';
import { createAudioGenerationWorker } from './queues/audio-generation.worker.js';
import { closeQueue } from './queues/audio-generation.queue.js';
import { shutdownPostHog } from './services/posthog.service.js';

// --- Sentry: initialize FIRST so early errors are captured ----------------
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

const PORT = env.PORT;
const FRONTEND_URL = env.FRONTEND_URL;
const API_URL = env.API_URL;
const SAME_ORIGIN = (() => {
  try {
    return new URL(FRONTEND_URL).origin === new URL(API_URL).origin;
  } catch {
    return false;
  }
})();

const app = express();

// Trust the platform proxy (Railway / Nginx / Cloudflare) so `req.ip`
// reflects the real client IP used by rate limiting and logging.
app.set('trust proxy', 1);

// --- Security -------------------------------------------------------------
// `helmet` ships strong defaults; disable CSP (API returns JSON, not HTML)
// and relax CORP so cross-origin consumers (the SPA on a different origin,
// or S3/R2 media responses) aren't blocked.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// --- Compression ----------------------------------------------------------
app.use(compression());

// --- CORS — only needed when the frontend is served from a different origin.
// In the unified Railway deployment the SPA and the API share
// `https://app.hypnosleep.app`, so CORS headers are unnecessary (and the
// browser never issues a preflight).
if (!SAME_ORIGIN) {
  // Build the allowlist from each entry's `.origin` (scheme + host + port).
  // `FRONTEND_URL` is validated as a full URL and may include a path, but
  // the browser's `Origin` request header is always origin-only, so a
  // direct string compare against `FRONTEND_URL` can silently fail CORS.
  const toOrigin = (candidate: string): string | null => {
    try {
      return new URL(candidate).origin;
    } catch {
      return null;
    }
  };
  const allowedOrigins = [FRONTEND_URL, 'https://hypnosleep.app']
    .map(toOrigin)
    .filter((o): o is string => o !== null);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
}

// --- Request body parsing -------------------------------------------------
// Stripe webhooks require the raw request body to verify signatures.
// The subscription router installs `express.raw()` for
// `/api/subscription/webhook`, so we skip the JSON parser on that path;
// otherwise we'd consume the body stream first and signature
// verification would fail. We match with a prefix (and fall back to
// `req.originalUrl` when the app is mounted under a sub-path) rather
// than an exact-string compare so a trailing slash or query string
// doesn't accidentally route the webhook through the JSON parser.
const STRIPE_WEBHOOK_PATH = '/api/subscription/webhook';
const jsonParser = express.json({ limit: '1mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '1mb' });
const isStripeWebhookRequest = (req: express.Request): boolean => {
  const candidate = req.originalUrl || req.path || '';
  // Strip query string before comparing so `?foo=bar` doesn't defeat the match.
  const pathPart = candidate.split('?', 1)[0];
  return (
    pathPart === STRIPE_WEBHOOK_PATH ||
    pathPart.startsWith(`${STRIPE_WEBHOOK_PATH}/`)
  );
};
app.use((req, res, next) => {
  if (isStripeWebhookRequest(req)) {
    next();
    return;
  }
  jsonParser(req, res, next);
});
app.use((req, res, next) => {
  if (isStripeWebhookRequest(req)) {
    next();
    return;
  }
  urlencodedParser(req, res, next);
});

// --- HTTP request logging -------------------------------------------------
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    autoLogging: {
      ignore: (req) => {
        // Don't log health checks.
        const url = (req as express.Request).url ?? '';
        return url === '/api/health' || url === '/health';
      },
    },
  }),
);

// --- Top-level health endpoint --------------------------------------------
// Runs BEFORE rate limiting so Railway healthchecks and uptime monitors
// never get 429'd under load. `/api/health` is registered by
// `registerRoutes()` as the canonical in-app health endpoint; `/health`
// is kept for platform probes that don't know about `/api/*`.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// --- IP-level rate limiting -----------------------------------------------
// Skip Stripe webhooks (own signature-based admission) and SSE streams
// (long-lived GETs that would exhaust the per-minute budget).
app.use((req, res, next) => {
  if (isStripeWebhookRequest(req)) {
    next();
    return;
  }
  if (req.method === 'GET' && req.path.endsWith('/events')) {
    next();
    return;
  }
  ipRateLimit(req, res, next);
});

// --- API routes ---
registerRoutes(app);

// --- Static frontend (Vite build) + SPA fallback --------------------------
// When `STATIC_DIR` points at a directory containing a built SPA (an
// `index.html` plus asset files), serve it from the same Express process
// so the frontend and API share a single origin. Any unmatched non-`/api`
// GET falls back to `index.html` so client-side routing works on refresh.
const staticDir = env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : null;
const indexHtml = staticDir ? path.join(staticDir, 'index.html') : null;

if (staticDir && indexHtml && fs.existsSync(indexHtml)) {
  app.use(
    express.static(staticDir, {
      // Hashed Vite assets are immutable; `index.html` must not be cached
      // so deploys roll out immediately.
      index: false,
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/\.(?:js|css|woff2?|png|jpe?g|svg|webp|gif|ico|mp3|wav|ogg)$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    // Don't hijack non-GET requests or explicit file extensions — let them
    // 404 through the normal Express flow.
    if (req.method !== 'GET') {
      next();
      return;
    }
    res.sendFile(indexHtml, (err) => {
      if (err) next(err);
    });
  });

  logger.info({ staticDir }, 'Serving built SPA from Express');
} else if (env.STATIC_DIR) {
  logger.warn(
    { staticDir: env.STATIC_DIR },
    'STATIC_DIR set but index.html not found — SPA will not be served',
  );
  // Fall through to the API-only `/` handler below.
}

// When no SPA is being served, expose a small JSON banner at `/` so
// human visitors and monitors hitting the bare origin get a
// well-formed response instead of a 404.
if (!(staticDir && indexHtml && fs.existsSync(indexHtml))) {
  app.get('/', (_req, res) => {
    res.json({ name: 'HypnoSleep API', version: '1.0.0' });
  });
}

// --- 404 + error handlers (MUST be last) ----------------------------------
app.use(notFoundHandler);
// Sentry's error handler captures 500s; install it right before our own
// formatter so errors are both reported and returned as structured JSON.
if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

// --- Start ---
let worker: ReturnType<typeof createAudioGenerationWorker> | null = null;
let shuttingDown = false;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: env.NODE_ENV }, '🚀 HypnoSleep API server started');

  // Start the audio generation worker if Redis is configured
  if (env.REDIS_URL) {
    try {
      worker = createAudioGenerationWorker();
      logger.info('Audio generation worker started');
    } catch (err) {
      logger.warn({ err }, 'Failed to start audio generation worker — running without it');
    }
  }
});

// --- Graceful shutdown ---
// Max time (ms) to wait for in-flight HTTP requests to drain before
// force-exiting. Platforms like Railway send SIGKILL after ~30s, so
// stay comfortably under that.
const SHUTDOWN_TIMEOUT_MS = 25_000;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal');

  // Stop accepting new HTTP connections and wait for in-flight requests
  // to finish. `server.close()` is asynchronous — without awaiting it we
  // could tear down the queue/worker (or `process.exit`) while requests
  // are still being served.
  const closeServer = new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) {
        logger.warn({ err }, 'HTTP server close reported an error');
      }
      resolve();
    });
  });
  const closeTimeout = new Promise<void>((resolve) => {
    const t = setTimeout(() => {
      logger.warn(
        { timeoutMs: SHUTDOWN_TIMEOUT_MS },
        'Timed out waiting for HTTP server to close — continuing shutdown',
      );
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    t.unref();
  });
  await Promise.race([closeServer, closeTimeout]);

  try {
    if (worker) {
      // Drain in-flight jobs before exiting so a Railway redeploy
      // doesn't abort an audio generation mid-pipeline.
      try {
        await worker.close();
      } catch (err) {
        logger.warn({ err }, 'Failed to close audio generation worker cleanly');
      }
    }
    // Close the queue's Redis connection so the process can exit
    // cleanly even if the worker was never started.
    await closeQueue().catch((err) => {
      logger.warn({ err }, 'Failed to close audio queue cleanly');
    });
    await shutdownPostHog();
  } catch (err) {
    logger.error({ err }, 'Unexpected error during shutdown');
  } finally {
    shuttingDown = false;
  }
  // Let the event loop drain naturally now that all resources are closed.
  // (We intentionally don't call `process.exit(0)` — leaving it to the
  // runtime means any still-pending I/O can finish flushing.)
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled promise rejection');
});

export { app };
