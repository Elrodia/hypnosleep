import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import { QUEUE_NAMES } from '../config/constants.js';
import { env } from '../config/env.js';
import { generateAudio } from '../modules/audio/audio.service.js';
import { mysqlDb } from '../db/mysql/client.js';
import { sessions } from '../db/mysql/schema/sessions.js';
import { users } from '../db/mysql/schema/users.js';
import { refundGeneration } from '../modules/sessions/sessions.service.js';
import { sendEmail } from '../services/email.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  generationBus,
  progressMirrorKey,
  type ProgressEvent,
  type ProgressStep,
} from './events.bus.js';
import { getRedis } from '../db/redis/client.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';
import { consumeCancelFlag } from '../modules/sessions/sessions.service.js';
import { enqueueNotification } from '../modules/notifications/notifications.controller.js';

/**
 * AppError codes that represent permanent, user-facing problems with
 * the request itself (not transient infrastructure issues). Jobs that
 * throw one of these abort immediately via `job.discard()` rather than
 * burning the queue's `attempts` budget on a re-run that's guaranteed
 * to fail the same way.
 */
const NON_RETRYABLE_ERROR_CODES = new Set([
  'SAFETY_FAILED',
  'VALIDATION_FAILED',
  'PRO_REQUIRED',
  'QUOTA_EXHAUSTED',
  'FORBIDDEN',
  'UNAUTHENTICATED',
  'CANCELLED',
]);

/**
 * TTL for the "last progress event" mirror kept in Redis per session.
 * Long enough that a user can reload during generation and still see
 * a meaningful progress bar; short enough that stale events don't
 * stick around after the job settles.
 */
const PROGRESS_MIRROR_TTL_SEC = 10 * 60;

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

        // Honor a cancel request that arrived between enqueue and
        // start: short-circuit the entire pipeline before paying for
        // any TTS work.
        if (await consumeCancelFlag(sessionId)) {
          throw new AppError('CANCELLED', 'Generation cancelled by user', 499);
        }

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

        // Final cancel check before we persist the ready state — if
        // the user cancelled during a long TTS run we honor it and
        // do not mark the session ready.
        if (await consumeCancelFlag(sessionId)) {
          throw new AppError('CANCELLED', 'Generation cancelled by user', 499);
        }

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

        // Inbox notification for the user. Best-effort — failures are
        // swallowed inside `enqueueNotification` so we never fail the
        // job over a missed bell ding.
        void enqueueNotification(userId, {
          type: 'session_ready',
          title: 'Your session is ready',
          body: title || 'Tap to listen now.',
          url: `/library?session=${sessionId}`,
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

        // For permanent, user-attributable failures (safety, validation,
        // quota), short-circuit the BullMQ retry policy: re-running the
        // same payload will produce the same error, so spending two
        // more attempts (and ~15s of backoff) is pure waste.
        if (err instanceof AppError && NON_RETRYABLE_ERROR_CODES.has(err.code)) {
          try {
            job.discard();
          } catch (discardErr) {
            logger.warn(
              { err: discardErr, sessionId },
              'Failed to mark job as non-retryable',
            );
          }
        }

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

    // Only run the expensive cleanup (refund, email, Sentry) once the
    // job is truly finished — i.e. all retry attempts are exhausted or
    // the error is one we already marked as non-retryable. Intermediate
    // attempts also fire `failed`; bailing out here keeps the user
    // from getting a "your session failed" email after attempt #1 when
    // attempts #2 and #3 might still succeed.
    if (!job) return;
    const maxAttempts = job.opts?.attempts ?? 1;
    const isNonRetryable =
      err instanceof AppError && NON_RETRYABLE_ERROR_CODES.has(err.code);
    const isFinalAttempt = job.attemptsMade >= maxAttempts || isNonRetryable;
    if (!isFinalAttempt) return;

    void handleFinalFailure(job, err).catch((cleanupErr) => {
      logger.error(
        { err: cleanupErr, jobId: job.id, sessionId: job.data.sessionId },
        'Final-failure cleanup raised',
      );
    });
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Audio generation worker error');
  });

  return worker;
}

/**
 * Cleanup that runs once a job has truly failed (no more retries).
 *
 * Steps performed in order, each guarded so a downstream failure
 * doesn't prevent the others from running:
 *
 *   1. Persist `sessions.status = 'failed'` (defence-in-depth — the
 *      per-attempt catch in the worker also sets this, but a crash
 *      between attempts could leave the row stuck on `generating`).
 *   2. Re-emit a final SSE `error` progress event. Late SSE
 *      subscribers that connected after the in-flight attempt's
 *      event was emitted still get a clean failure signal.
 *   3. Refund the free-tier monthly generation quota — the user
 *      paid (in quota) for an artifact they never received.
 *   4. Send a transactional error email via Resend with a
 *      "Try Again" CTA pointing back to the create page.
 *   5. Capture the failure in Sentry with the full job-data
 *      context for debugging.
 */
async function handleFinalFailure(
  job: Job<AudioGenerationJobData>,
  err: Error,
): Promise<void> {
  const { sessionId, userId, isPro, title } = job.data;
  const message = err.message ?? 'Unknown error';

  // 1. Persist failure state.
  try {
    await mysqlDb
      .update(sessions)
      .set({ status: 'failed' })
      .where(eq(sessions.id, sessionId));
  } catch (dbErr) {
    logger.error(
      { err: dbErr, sessionId },
      'Final-failure: failed to mark session as failed',
    );
  }

  // 2. Re-emit a final error event so any still-connected SSE
  //    subscribers see the terminal state and close cleanly.
  try {
    generationBus.emitProgress(sessionId, {
      step: 'error',
      progress: 0,
      message: 'Generation failed',
      error: message,
    });
  } catch (emitErr) {
    logger.warn(
      { err: emitErr, sessionId },
      'Final-failure: failed to emit terminal SSE event',
    );
  }

  // 3. Refund the free-tier quota slot. Pro users are unmetered, so
  //    skip the refund for them.
  if (isPro !== true) {
    try {
      await refundGeneration(userId);
    } catch (refundErr) {
      logger.error(
        { err: refundErr, sessionId, userId },
        'Final-failure: failed to refund free-tier generation quota',
      );
    }
  }

  // 4. Look up the user's email and send a Try-Again notice.
  try {
    const [user] = await mysqlDb
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.email) {
      const retryUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/create?retry=${encodeURIComponent(sessionId)}`;
      const retryUrlHtml = escapeHtml(retryUrl);
      const safeTitle = title ?? 'your session';
      const greetingText = user.name ? `Hi ${user.name},` : 'Hi,';
      const greetingHtml = user.name ? `Hi ${escapeHtml(user.name)},` : 'Hi,';
      await sendEmail({
        to: user.email,
        subject: 'We couldn\u2019t finish your HypnoSleep session',
        text:
          `${greetingText}\n\n` +
          `We hit a snag generating ${safeTitle}. Your free generation has been refunded — ` +
          `you can try again at:\n${retryUrl}\n\n` +
          `If this keeps happening, reply to this email and we\u2019ll take a look.\n\n` +
          `— The HypnoSleep team`,
        html:
          `<p>${greetingHtml}</p>` +
          `<p>We hit a snag generating <strong>${escapeHtml(safeTitle)}</strong>. ` +
          `Your free generation has been refunded — you can try again with one click:</p>` +
          `<p><a href="${retryUrlHtml}" style="display:inline-block;padding:10px 16px;` +
          `background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Try Again</a></p>` +
          `<p style="color:#666;font-size:13px;">If the button doesn\u2019t work, paste this link into your browser:<br/>` +
          `<span style="word-break:break-all;">${retryUrlHtml}</span></p>` +
          `<p style="color:#666;font-size:13px;">If this keeps happening, just reply to this email — we\u2019ll take a look.</p>` +
          `<p style="color:#666;font-size:13px;">— The HypnoSleep team</p>`,
      });
    } else {
      logger.warn(
        { sessionId, userId },
        'Final-failure: user has no email on record; skipping retry email',
      );
    }
  } catch (emailErr) {
    logger.error(
      { err: emailErr, sessionId, userId },
      'Final-failure: failed to send retry email',
    );
  }

  // 5. Sentry capture with full job context. Guarded behind a DSN
  //    check so dev/test runs don't trigger the SDK\u2019s init warning.
  if (env.SENTRY_DSN) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('queue', 'audio-generation');
        scope.setUser({ id: userId });
        scope.setContext('job', {
          id: job.id,
          name: job.name,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts?.attempts ?? 1,
          sessionId,
          isPro: isPro === true,
          // Avoid logging full script text \u2014 it can contain user prompts.
          title,
        });
        Sentry.captureException(err);
      });
    } catch (sentryErr) {
      logger.warn({ err: sentryErr }, 'Final-failure: Sentry capture raised');
    }
  }
}

/**
 * Minimal HTML escape for values interpolated into the failure
 * email body. Sufficient for plain-text user content (titles); not
 * a substitute for a full sanitiser on rich input.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
