import { unlink, stat } from 'node:fs/promises';
import { synthesizeVoice } from './audio.tts.js';
import { mixWithBackground, probeDuration, type BackgroundSound } from './audio.mixer.js';
import { uploadFile, buildSessionKey } from './audio.s3.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

/** Input for {@link generateAudio}. */
export interface GenerateAudioInput {
  userId: string;
  sessionId: string;
  /** Plain text or SSML script to synthesize. */
  scriptText: string;
  /** Edge-TTS voice identifier, e.g. `en-US-AnaNeural`. */
  voiceId: string;
  /** Background ambient loop name. `silence` skips the FFmpeg mix step. */
  background: BackgroundSound;
}

/** Result of a successful audio generation pipeline run. */
export interface GeneratedAudio {
  /** S3 object key under which the final MP3 was uploaded. */
  audioKey: string;
  /** Duration of the final MP3 in whole seconds. */
  durationSec: number;
  /** Size of the final MP3 in bytes. */
  fileSizeBytes: number;
}

/**
 * Runs the full audio generation pipeline:
 *
 *   1. Synthesize voice via Edge TTS (`audio.tts`)
 *   2. Mix with background ambient loop via FFmpeg (`audio.mixer`),
 *      skipped when `background === 'silence'`
 *   3. Probe duration + file size of the final MP3
 *   4. Upload the final MP3 to S3 (`audio.s3`)
 *
 * All intermediate temp files are deleted in a `finally` block whether
 * the pipeline succeeds or fails. Errors are normalised to `AppError`
 * with code `GENERATION_FAILED`.
 */
export async function generateAudio(
  input: GenerateAudioInput,
): Promise<GeneratedAudio> {
  let voicePath: string | null = null;
  let mixedPath: string | null = null;

  try {
    // Step 1: synthesize voice
    voicePath = await synthesizeVoice({
      voiceId: input.voiceId,
      text: input.scriptText,
    });
    logger.debug({ voicePath, sessionId: input.sessionId }, 'Voice synthesized');

    // Step 2: mix with background (or skip if silence)
    if (input.background === 'silence') {
      mixedPath = voicePath;
      voicePath = null; // prevent double cleanup
    } else {
      mixedPath = await mixWithBackground({
        voicePath,
        background: input.background,
      });
      logger.debug({ mixedPath, sessionId: input.sessionId }, 'Mixed with background');
    }

    // Step 3: get duration + size
    const durationSec = Math.round(await probeDuration(mixedPath));
    const fileStat = await stat(mixedPath);

    // Step 4: upload to S3
    const audioKey = buildSessionKey(input.userId, input.sessionId);
    await uploadFile(mixedPath, audioKey);

    return {
      audioKey,
      durationSec,
      fileSizeBytes: fileStat.size,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      'GENERATION_FAILED',
      `Audio pipeline failed: ${(err as Error).message}`,
      500,
    );
  } finally {
    // Cleanup
    if (voicePath) await unlink(voicePath).catch(() => {});
    if (mixedPath) await unlink(mixedPath).catch(() => {});
  }
}
