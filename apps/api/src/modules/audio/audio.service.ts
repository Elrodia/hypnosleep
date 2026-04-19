import { unlink, stat } from 'node:fs/promises';
import {
  synthesizeVoice,
  synthesizeVoiceChunks,
  splitScriptIntoChunks,
} from './audio.tts.js';
import {
  mixWithBackground,
  probeDuration,
  concatMp3Files,
  type BackgroundSound,
} from './audio.mixer.js';
import { uploadFile, buildSessionKey } from './audio.s3.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/errors.js';

/**
 * Callback invoked as the pipeline progresses. `step` matches the
 * worker's SSE step names; `percent` is 0–100.
 */
export type AudioProgressCallback = (update: {
  step: 'tts' | 'mix' | 'upload';
  percent: number;
  message: string;
}) => void | Promise<void>;

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
  /**
   * Optional callback invoked after each internal step (per TTS chunk,
   * after mix, after upload). Used by the BullMQ worker to forward
   * live progress to SSE subscribers.
   */
  onProgress?: AudioProgressCallback;
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

/** TTS percent range: chunk progress is distributed linearly in here. */
const TTS_START = 20;
const TTS_END = 50;
/** Mix + upload use fixed percents so the UX shows forward motion. */
const MIX_PERCENT = 70;
const UPLOAD_PERCENT = 90;

/**
 * Runs the full audio generation pipeline:
 *
 *   1. Synthesize voice via Edge TTS (`audio.tts`). Long scripts are
 *      split on paragraph boundaries (`splitScriptIntoChunks`) and
 *      synthesised chunk-by-chunk, then concatenated via FFmpeg, so
 *      per-subprocess timeouts never become a hard ceiling on total
 *      session length.
 *   2. Mix with background ambient loop via FFmpeg (`audio.mixer`),
 *      skipped when `background === 'silence'`.
 *   3. Probe duration + file size of the final MP3.
 *   4. Upload the final MP3 to S3 (`audio.s3`).
 *
 * Intermediate temp files (per-chunk MP3s + concatenated voice +
 * mixed output) are deleted in a `finally` block whether the pipeline
 * succeeds or fails. Errors are normalised to {@link AppError} with
 * code `GENERATION_FAILED`.
 */
export async function generateAudio(
  input: GenerateAudioInput,
): Promise<GeneratedAudio> {
  const tempFiles: string[] = [];
  const emit = async (
    step: 'tts' | 'mix' | 'upload',
    percent: number,
    message: string,
  ): Promise<void> => {
    if (!input.onProgress) return;
    try {
      await input.onProgress({ step, percent, message });
    } catch (err) {
      logger.warn({ err, step }, 'onProgress callback threw');
    }
  };

  try {
    // ── Step 1: synthesize voice (chunked if long) ───────────────
    const chunks = splitScriptIntoChunks(input.scriptText);
    await emit('tts', TTS_START, `Synthesising voice (0/${chunks.length})...`);

    let voicePath: string;
    if (chunks.length === 0) {
      throw new AppError(
        'GENERATION_FAILED',
        'Script is empty after chunking',
        500,
      );
    } else if (chunks.length === 1) {
      voicePath = await synthesizeVoice({
        voiceId: input.voiceId,
        text: chunks[0],
      });
      tempFiles.push(voicePath);
      await emit('tts', TTS_END, 'Voice synthesised');
    } else {
      const chunkPaths = await synthesizeVoiceChunks(
        chunks,
        { voiceId: input.voiceId },
        async (i, total) => {
          const pct = TTS_START + Math.round(((i + 1) / total) * (TTS_END - TTS_START));
          await emit(
            'tts',
            pct,
            `Synthesising voice (${i + 1}/${total})...`,
          );
        },
      );
      // Track every chunk for cleanup.
      tempFiles.push(...chunkPaths);
      voicePath = await concatMp3Files(chunkPaths);
      // Only track the concatenated file when it's a fresh output —
      // `concatMp3Files` returns the sole input unchanged when given
      // just one, in which case it's already in `tempFiles`.
      if (!chunkPaths.includes(voicePath)) {
        tempFiles.push(voicePath);
      }
    }
    logger.debug({ voicePath, sessionId: input.sessionId }, 'Voice synthesized');

    // ── Step 2: mix with background (or skip if silence) ─────────
    let mixedPath: string;
    if (input.background === 'silence') {
      mixedPath = voicePath;
    } else {
      await emit('mix', MIX_PERCENT, 'Mixing with background...');
      mixedPath = await mixWithBackground({
        voicePath,
        background: input.background,
      });
      tempFiles.push(mixedPath);
      logger.debug({ mixedPath, sessionId: input.sessionId }, 'Mixed with background');
    }

    // ── Step 3: probe duration + size ────────────────────────────
    const durationSec = Math.round(await probeDuration(mixedPath));
    const fileStat = await stat(mixedPath);

    // ── Step 4: upload to S3 ─────────────────────────────────────
    await emit('upload', UPLOAD_PERCENT, 'Uploading your session...');
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
    // Cleanup every intermediate file. Dedupe because concat may have
    // returned the sole chunk path unchanged.
    for (const p of new Set(tempFiles)) {
      await unlink(p).catch(() => {});
    }
  }
}
