import { execa } from 'execa';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Directory containing the bundled background ambient loops (`rain.mp3`,
 * `ocean.mp3`, etc.). Resolved from the API working directory so it works
 * in both `tsx` (development) and the runtime container.
 */
const BG_DIR = join(process.cwd(), 'assets', 'backgrounds');

/** Background ambient loop name (without `.mp3` extension). */
export type BackgroundSound =
  | 'rain'
  | 'ocean'
  | 'forest'
  | 'wind'
  | 'white_noise'
  | 'silence';

/** Options for {@link mixWithBackground}. */
export interface MixOptions {
  /** Absolute path to the voice MP3 produced by Edge TTS. */
  voicePath: string;
  /** Background loop to mix in. */
  background: BackgroundSound;
  /** Voice gain in dB; default `0`. */
  voiceVolumeDb?: number;
  /** Background gain in dB; default `-12`. */
  bgVolumeDb?: number;
  /** Fade-in duration in seconds; default `3`. */
  fadeInSec?: number;
  /** Fade-out duration in seconds; default `3`. */
  fadeOutSec?: number;
}

/**
 * Probes a media file for its duration in seconds using `ffprobe`.
 *
 * @returns The duration in seconds.
 * @throws {AppError} `GENERATION_FAILED` if probing fails or the duration
 *   cannot be parsed.
 */
async function probeDurationSec(path: string): Promise<number> {
  try {
    const { stdout } = await execa('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    const duration = parseFloat(stdout);
    if (!isFinite(duration) || duration <= 0) {
      throw new AppError('GENERATION_FAILED', `Could not probe media duration for "${path}"`, 500);
    }
    return duration;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(
      'GENERATION_FAILED',
      `ffprobe failed for "${path}": ${message}`,
      500,
    );
  }
}

/**
 * Mixes a voice MP3 with a looped background ambient track using FFmpeg.
 *
 * - The background is looped infinitely and trimmed to the voice length.
 * - Voice and background are gain-staged independently (defaults: 0 dB
 *   voice, -12 dB background).
 * - Symmetric fade-in / fade-out are applied to the final mix.
 *
 * @returns Absolute path to the mixed MP3. The caller owns the file and
 *   must `unlink` it when finished.
 * @throws {AppError} `GENERATION_FAILED` if FFmpeg fails. Any partial
 *   output file is cleaned up.
 */
export async function mixWithBackground(opts: MixOptions): Promise<string> {
  const tmpDir = join(tmpdir(), 'hypnosleep-mix');
  await mkdir(tmpDir, { recursive: true });
  const outPath = join(tmpDir, `${randomUUID()}.mp3`);

  const bgPath = join(BG_DIR, `${opts.background}.mp3`);
  const voiceVol = opts.voiceVolumeDb ?? 0;
  const bgVol = opts.bgVolumeDb ?? -12;
  const fadeIn = opts.fadeInSec ?? 3;
  const fadeOut = opts.fadeOutSec ?? 3;

  // Get voice duration first (we trim background to match).
  const voiceDuration = await probeDurationSec(opts.voicePath);
  // Clamp fade-out start to >= 0 in case the voice is shorter than the
  // requested fade-out window.
  const fadeOutStart = Math.max(0, voiceDuration - fadeOut);

  // FFmpeg filter graph:
  //   [0:a] = voice, [1:a] = background
  //   apply per-source volume, mix, fade in/out, output
  const filter = `
    [0:a]volume=${voiceVol}dB,aresample=44100[voice];
    [1:a]aloop=loop=-1:size=2e9,atrim=0:${voiceDuration.toFixed(2)},volume=${bgVol}dB,aresample=44100[bg];
    [voice][bg]amix=inputs=2:duration=first:dropout_transition=0,
    afade=t=in:st=0:d=${fadeIn},
    afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeOut}[out]
  `.replace(/\s+/g, '');

  try {
    await execa('ffmpeg', [
      '-y',
      '-i', opts.voicePath,
      '-stream_loop', '-1', '-i', bgPath,
      '-filter_complex', filter,
      '-map', '[out]',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-ar', '44100',
      outPath,
    ], { timeout: 180_000 });

    logger.debug(
      { outPath, voiceDuration, background: opts.background },
      'Audio mix complete',
    );
    return outPath;
  } catch (err) {
    await unlink(outPath).catch(() => {});
    throw new AppError(
      'GENERATION_FAILED',
      `FFmpeg mix failed: ${(err as Error).message}`,
      500,
    );
  }
}

/**
 * Probes a media file for its duration in seconds. Public wrapper around
 * the internal `ffprobe` helper, used by the orchestrator to compute the
 * final session duration.
 */
export async function probeDuration(path: string): Promise<number> {
  return probeDurationSec(path);
}
