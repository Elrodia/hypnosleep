import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes.js';
import { createAudioGenerationWorker } from './queues/audio-generation.worker.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const FRONTEND_URL = 'https://app.hypnosleep.app';

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

// CORS
app.use((_req, res, next) => {
  const frontendUrl = FRONTEND_URL;
  res.header('Access-Control-Allow-Origin', frontendUrl);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

// --- Routes ---
registerRoutes(app);

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start ---
let worker: ReturnType<typeof createAudioGenerationWorker> | null = null;

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, '🚀 HypnoSleep API server started');

  // Start the audio generation worker if Redis is configured
  if (process.env.REDIS_URL) {
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
    await worker.close();
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app };
