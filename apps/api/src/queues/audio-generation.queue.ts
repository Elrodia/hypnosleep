import { Queue, type JobsOptions } from 'bullmq';
import { QUEUE_NAMES } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';

/** BullMQ priority assigned to Pro-plan jobs (lower = higher priority). */
const PRIORITY_PRO = 1;
/** BullMQ priority assigned to free-plan jobs. */
const PRIORITY_FREE = 10;

let queue: Queue<AudioGenerationJobData> | null = null;

/**
 * Returns the (lazily-constructed) BullMQ audio generation queue.
 *
 * The Redis connection is created from `REDIS_URL` on first use so
 * the module can be imported in environments (tests, tooling) where
 * Redis is not configured. Throws a descriptive error when used
 * without configuration.
 */
function getQueue(): Queue<AudioGenerationJobData> {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is not set');
    }

    const url = new URL(redisUrl);
    queue = new Queue<AudioGenerationJobData>(QUEUE_NAMES.AUDIO_GENERATION, {
      connection: {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        // Keep recent successes for a short debug window, then prune.
        removeOnComplete: { age: 3600, count: 1000 },
        // Keep failures for 24h to support manual retry/inspection.
        removeOnFail: { age: 86_400 },
      },
    });
  }

  return queue;
}

/**
 * Enqueues an audio generation job.
 *
 * - `jobId` is set to `sessionId` so the same session is never queued
 *   twice (BullMQ dedupes on jobId).
 * - Pro users receive a higher priority than free users.
 * - Default retry/backoff/eviction policies live on the queue itself
 *   (see `defaultJobOptions` above) and can be overridden per-call
 *   via `opts`.
 *
 * @returns The BullMQ job id (always equal to `data.sessionId` here).
 */
export async function enqueueAudioGeneration(
  data: AudioGenerationJobData,
  opts: JobsOptions = {},
): Promise<string> {
  const q = getQueue();
  const priority = data.isPro ? PRIORITY_PRO : PRIORITY_FREE;

  const job = await q.add('generate-audio', data, {
    jobId: data.sessionId,
    priority,
    ...opts,
  });

  logger.info(
    { jobId: job.id, sessionId: data.sessionId, priority },
    'Audio generation job enqueued',
  );

  return job.id ?? data.sessionId;
}

/**
 * Looks up the current state and progress of a generation job by
 * `sessionId`. Returns `null` when no job exists (either it was
 * never queued or it has been evicted by the retention policy).
 *
 * `progress` is reported as `number` because the worker only ever
 * calls `job.updateProgress(<number>)`. BullMQ's underlying type is
 * wider, so we narrow it here for callers.
 */
export async function getJobStatus(sessionId: string): Promise<{
  state: string;
  progress: number;
  failedReason: string | undefined;
} | null> {
  const job = await getQueue().getJob(sessionId);
  if (!job) return null;
  const state = await job.getState();
  return {
    state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    failedReason: job.failedReason,
  };
}

/**
 * Closes the queue connection gracefully. Safe to call multiple
 * times; subsequent calls are no-ops.
 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
