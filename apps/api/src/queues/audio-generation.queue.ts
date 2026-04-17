import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';

let queue: Queue | null = null;

/**
 * Returns the BullMQ audio generation queue.
 */
function getQueue(): Queue {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is not set');
    }

    const url = new URL(redisUrl);
    queue = new Queue(QUEUE_NAMES.AUDIO_GENERATION, {
      connection: {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
      },
    });
  }

  return queue;
}

/**
 * Enqueues an audio generation job.
 * Returns the BullMQ job ID for tracking.
 */
export async function enqueueAudioGeneration(
  data: AudioGenerationJobData,
): Promise<string> {
  const q = getQueue();

  const job = await q.add('generate-audio', data, {
    jobId: data.sessionId,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  logger.info(
    { jobId: job.id, sessionId: data.sessionId },
    'Audio generation job enqueued',
  );

  return job.id ?? data.sessionId;
}

/**
 * Closes the queue connection gracefully.
 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
