import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { QUEUE_NAMES } from '../config/constants.js';
import { generateAudio } from '../modules/audio/audio.service.js';
import { mysqlDb } from '../db/mysql/client.js';
import { sessions } from '../db/mysql/schema/sessions.js';
import { logger } from '../utils/logger.js';
import {
  generationBus,
  type ProgressEvent,
  type ProgressStep,
} from './events.bus.js';
import { getRedis } from '../db/redis/client.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';

/**
 * TTL for the "last progress event" mirror kept in Redis per session.
 * Long enough that a user can reload during generation and still see
 * a meaningful progress bar; short enough that stale events don't
 * stick around after the job settles.
 */
const PROGRESS_MIRROR_TTL_SEC = 10 * 60;

/**
 * Redis key used to mirror the last {@link ProgressEvent} for a
 * session. Read by `GET /api/sessions/:id` so reloads can re-render
 * an in-flight generation without reconnecting SSE from scratch.
 */
export function progressMirrorKey(sessionId: string): string {
  return `session:progress:${sessionId}`;
}

/**
 * BullMQ worker that processes audio generation jobs.
 *
 * Pipeline (delegated to `modules/audio/audio.service.generateAudio`):
 *
 *   1. Chunked Edge-TTS synthesis (paragraph-boundary splits),
 *   2. FFmpeg mix with a looped background loop + symmetric fades
 *      (skipped when `background === 'silence'`),
 *   3. Duration + file-size probe of the final MP3,
 *   4. Upload to S3-compatible storage under `audio/{userId}/{sessionId}.mp3`.
 *
 * Each pipeline step emits a {@link ProgressEvent} on the in-process
 * {@link generationBus} so the SSE handler can stream live progress
 * to the frontend. The bus is in-process by design (single Railway
 * dyno); see `events.bus.ts` for the rationale and migration path.
 *
 * The last event for a session is also *mirrored* to Redis with a
 * {@link PROGRESS_MIRROR_TTL_SEC} TTL so `GET /api/sessions/:id` can
 * return the latest progress snapshot to clients that reload the
 * page mid-generation.
 *
 * Errors are caught here so we can:
 *  - Mark the session as `failed` in MySQL,
 *  - Emit an `error` progress event (so the SSE client closes cleanly),
 *  - Re-throw so BullMQ records the failure and triggers retries
 *    according to the queue's `attempts` policy.
 */
export function createAudioGenerationWorker(): Worker<AudioGenerationJobData> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is not set');
  }

  const url = new URL(redisUrl);

  const worker = new Worker<AudioGenerationJobData>(
    QUEUE_NAMES.AUDIO_GENERATION,
    async (job: Job<AudioGenerationJobData>) => {
      const {
        sessionId,
        userId,
        scriptText,
        title,
        voiceId,
        backgroundSound,
      } = job.data;

      /**
       * Emit a progress event on the in-process bus, mirror it to
       * Redis, and forward to BullMQ's `updateProgress`. Errors are
       * swallowed because event delivery is best-effort and must
       * never fail the job itself.
       */
      const emit = (
        step: ProgressStep,
        progress: number,
        message: string,
        extra: Partial<ProgressEvent> = {},
      ): void => {
        const payload: ProgressEvent = { step, progress, message, ...extra };
        void job.updateProgress(progress).catch((err) => {
          logger.debug(
            { err, sessionId, step },
            'Failed to update BullMQ job progress',
          );
        });
        try {
          generationBus.emitProgress(sessionId, payload);
        } catch (err) {
          logger.warn({ err, sessionId }, 'Failed to emit progress event');
        }
        // Mirror to Redis so `GET /api/sessions/:id` can surface
        // in-flight progress on a reload. Fire-and-forget.
        const redis = getRedis();
        if (redis) {
          void redis
            .set(
              progressMirrorKey(sessionId),
              JSON.stringify(payload),
              'EX',
              PROGRESS_MIRROR_TTL_SEC,
            )
            .catch((err) => {
              logger.debug(
                { err, sessionId },
                'Failed to mirror progress to Redis',
              );
            });
        }
      };

      logger.info(
        { sessionId, userId, voiceId, backgroundSound, title },
        'Audio generation job started',
      );

      try {
        // Initial "script ready" marker — script was already generated
        // synchronously in `createGenerationSession`, so the worker's
        // first real step is TTS. We still emit a `script` ping here
        // so the client's progress bar leaves the `queued` state
        // immediately.
        emit('script', 10, 'Script ready, preparing audio...');

        const result = await generateAudio({
          userId,
          sessionId,
          scriptText,
          voiceId,
          background: backgroundSound,
          onProgress: ({ step, percent, message }) => {
            emit(step, percent, message);
          },
        });

        // Persist final row state. We store the S3 *key* in
        // `audio_url` as a marker of readiness — presigned URLs are
        // minted on demand by `getAudioUrl` in sessions.service.
        await mysqlDb
          .update(sessions)
          .set({
            status: 'ready',
            audioUrl: result.audioKey,
            durationSec: result.durationSec,
          })
          .where(eq(sessions.id, sessionId));

        emit('done', 100, 'Your session is ready!', {
          audioUrl: result.audioKey,
        });

        logger.info(
          {
            sessionId,
            audioKey: result.audioKey,
            title,
            fileSizeBytes: result.fileSizeBytes,
            durationSec: result.durationSec,
          },
          'Audio generation complete — session ready',
        );

        return {
          sessionId,
          audioKey: result.audioKey,
          status: 'ready' as const,
          durationSec: result.durationSec,
        };
      } catch (err) {
        const message = (err as Error).message ?? 'Unknown error';
        logger.error({ err, sessionId }, 'Audio generation job failed');

        // Persist failure state so the REST endpoint reflects reality
        // even when the SSE client never connected. Wrapped in its
        // own try/catch so a DB outage doesn't mask the original
        // error from BullMQ.
        try {
          await mysqlDb
            .update(sessions)
            .set({ status: 'failed' })
            .where(eq(sessions.id, sessionId));
        } catch (dbErr) {
          logger.error(
            { err: dbErr, sessionId },
            'Failed to mark session as failed in MySQL',
          );
        }

        emit('error', 0, 'Generation failed', { error: message });

        // Re-throw so BullMQ marks the job as failed and applies the
        // queue's retry/backoff policy (see audio-generation.queue.ts).
        throw err;
      }
    },
    {
      connection: {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
      },
      // Process up to N jobs in parallel within this single worker.
      concurrency: 3,
      // Global rate cap to respect upstream provider quotas (Gemini RPM,
      // Edge TTS fair-use). Applies across all concurrent jobs.
      limiter: {
        max: 10,
        duration: 60_000, // per minute
      },
    },
  );

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job.id, sessionId: job.data.sessionId },
      'Audio generation job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, sessionId: job?.data.sessionId, err },
      'Audio generation job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Audio generation worker error');
  });

  return worker;
}
