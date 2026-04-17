import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES } from '../config/constants.js';
import { synthesizeSpeech, mixAudioWithBackground } from '../modules/ai/tts.service.js';
import { uploadAudio } from '../services/r2.service.js';
import { logger } from '../utils/logger.js';
import type { AudioGenerationJobData } from '../modules/ai/ai.types.js';

/**
 * BullMQ worker that processes audio generation jobs.
 *
 * Pipeline:
 * 1. Synthesize speech from script text via Edge TTS
 * 2. Mix voice audio with background sound via FFmpeg
 * 3. Upload the final audio to S3-compatible storage
 * 4. Update session record with audio URL and status
 */
export function createAudioGenerationWorker(): Worker {
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

      logger.info(
        { sessionId, userId, voiceId, backgroundSound },
        'Audio generation job started',
      );

      try {
        // Step 1: Generate voice audio via Edge TTS
        await job.updateProgress(20);
        logger.info({ sessionId }, 'Step 1: Synthesizing speech...');
        const voiceAudio = await synthesizeSpeech(scriptText, voiceId);

        // Step 2: Mix with background sound via FFmpeg
        await job.updateProgress(50);
        logger.info({ sessionId }, 'Step 2: Mixing audio with background...');
        const durationSec = durationMinutes * 60;
        const finalAudio = await mixAudioWithBackground(
          voiceAudio,
          backgroundSound,
          durationSec,
        );

        // Step 3: Upload to S3-compatible storage
        await job.updateProgress(80);
        logger.info({ sessionId }, 'Step 3: Uploading to S3...');
        const audioKey = `sessions/${userId}/${sessionId}.mp3`;
        const audioUrl = await uploadAudio(audioKey, finalAudio);

        // Step 4: Update session record in database
        await job.updateProgress(95);
        logger.info({ sessionId }, 'Step 4: Updating session record...');

        // TODO: Update MySQL sessions table with:
        // - status = 'ready'
        // - audio_url = audioUrl
        // - script_text = scriptText
        // - duration_sec = finalAudio duration
        // For now, log the result
        logger.info(
          {
            sessionId,
            audioUrl,
            title,
            audioSizeBytes: finalAudio.length,
          },
          'Audio generation complete — session ready',
        );

        await job.updateProgress(100);

        return { sessionId, audioUrl, status: 'ready' };
      } catch (err) {
        logger.error(
          { err, sessionId },
          'Audio generation job failed',
        );

        // TODO: Update MySQL sessions table with status = 'failed'

        throw err;
      }
    },
    {
      connection: {
        host: url.hostname,
        port: parseInt(url.port, 10) || 6379,
        password: url.password || undefined,
      },
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute (respects Gemini 15 RPM limit)
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
