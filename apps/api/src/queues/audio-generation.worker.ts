import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { QUEUE_NAMES } from '../config/constants.js';
import { synthesizeSpeech, mixAudioWithBackground } from '../modules/ai/tts.service.js';
import { uploadAudio } from '../services/r2.service.js';
import { mysqlDb } from '../db/mysql/client.js';
import { sessions } from '../db/mysql/schema/sessions.js';
import { logger } from '../utils/logger.js';
import { generationBus, type ProgressEvent, type ProgressStep } from './events.bus.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';

/**
 * BullMQ worker that processes audio generation jobs.
 *
 * Pipeline:
 *  1. Synthesize speech from script text via Edge TTS
 *  2. Mix voice audio with background sound via FFmpeg
 *  3. Upload the final audio to S3-compatible storage
 *  4. Update the `sessions` MySQL row with the audio URL & status
 *
 * Each step emits a {@link ProgressEvent} on the in-process
 * {@link generationBus} so the SSE handler in
 * `modules/sessions/sessions.sse.ts` can stream live progress to the
 * frontend. The bus is in-process by design (single Railway dyno);
 * see `events.bus.ts` for the rationale and the migration path.
 *
 * Errors are caught here so we can:
 *  - Mark the session as `failed` in MySQL
 *  - Emit an `error` progress event (so the SSE client closes cleanly)
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
        durationMinutes,
      } = job.data;

      /**
       * Helper that updates BullMQ progress AND emits a SSE-bus event
       * in lock-step. Errors from the bus are swallowed because event
       * delivery is best-effort and must never fail a job.
       */
      const emit = (
        step: ProgressStep,
        progress: number,
        message: string,
        extra: Partial<ProgressEvent> = {},
      ): void => {
        // Fire-and-forget: BullMQ progress updates are async but we
        // don't need to await them for SSE delivery. Log failures at
        // debug level so they're observable without masking the bus
        // emission, which is the user-visible path.
        void job.updateProgress(progress).catch((err) => {
          logger.debug(
            { err, sessionId, step },
            'Failed to update BullMQ job progress',
          );
        });
        try {
          generationBus.emitProgress(sessionId, {
            step,
            progress,
            message,
            ...extra,
          });
        } catch (err) {
          logger.warn({ err, sessionId }, 'Failed to emit progress event');
        }
      };

      logger.info(
        { sessionId, userId, voiceId, backgroundSound },
        'Audio generation job started',
      );

      try {
        // Step 1: Generate voice audio via Edge TTS
        emit('tts', 20, 'Generating soothing voice audio...');
        const voiceAudio = await synthesizeSpeech(scriptText, voiceId);

        // Step 2: Mix with background sound via FFmpeg
        emit('mix', 50, 'Mixing in background sounds...');
        const durationSec = durationMinutes * 60;
        const finalAudio = await mixAudioWithBackground(
          voiceAudio,
          backgroundSound,
          durationSec,
        );

        // Step 3: Upload to S3-compatible storage
        emit('upload', 80, 'Uploading your session...');
        const audioKey = `sessions/${userId}/${sessionId}.mp3`;
        const audioUrl = await uploadAudio(audioKey, finalAudio);

        // Step 4: Update session record in database
        await mysqlDb
          .update(sessions)
          .set({
            status: 'ready',
            audioUrl,
            scriptText,
            durationSec,
          })
          .where(eq(sessions.id, sessionId));

        emit('done', 100, 'Your session is ready!', { audioUrl });

        logger.info(
          {
            sessionId,
            audioUrl,
            title,
            audioSizeBytes: finalAudio.length,
            durationSec,
          },
          'Audio generation complete — session ready',
        );

        return { sessionId, audioUrl, status: 'ready' as const, durationSec };
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
