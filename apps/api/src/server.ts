import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes.js';
import { createAudioGenerationWorker } from './queues/audio-generation.worker.js';
import { closeQueue } from './queues/audio-generation.queue.js';

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

// --- Middleware ---
app.use(express.json({ limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => {
        // Don't log health checks
        return (req as express.Request).url === '/api/health';
      },
    },
  }),
);

// CORS — only needed when the frontend is served from a different origin.
// In the unified Railway deployment the SPA and the API share
// `https://app.hypnosleep.app`, so CORS headers are unnecessary (and the
// browser never issues a preflight).
if (!SAME_ORIGIN) {
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', FRONTEND_URL);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });
}

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
}

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start ---
let worker: ReturnType<typeof createAudioGenerationWorker> | null = null;

app.listen(PORT, () => {
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
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');

  if (worker) {
    // Drain in-flight jobs before exiting so a Railway redeploy
    // doesn't abort an audio generation mid-pipeline.
    await worker.close();
  }
  // Close the queue's Redis connection so the process can exit
  // cleanly even if the worker was never started.
  await closeQueue().catch((err) => {
    logger.warn({ err }, 'Failed to close audio queue cleanly');
  });

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
