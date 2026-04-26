import { execa } from 'execa';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { BackgroundSound } from '../../config/constants.js';

/**
 * Directory containing the bundled background ambient loops (`rain.mp3`,
 * `ocean.mp3`, etc.). Resolved from the API working directory so it works
 * in both `tsx` (development) and the runtime container.
 */
const BG_DIR = join(process.cwd(), 'assets', 'backgrounds');

export type { BackgroundSound } from '../../config/constants.js';

/** Options for {@link mixWithBackground}. */
export interface MixOptions {
  /** Absolute path to the voice MP3 produced by Edge TTS. */
  voicePath: string;
  /**
   * Background loop to mix in. When `'silence'`, the function is a no-op
   * and returns `voicePath` unchanged (no FFmpeg invocation, no temp
   * file allocated).
   */
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
 * - When `background === 'silence'` the function returns `voicePath`
 *   unchanged (no FFmpeg invocation, no temp file allocated). The
 *   caller still owns the original voice file.
 * - Otherwise the background is looped infinitely and trimmed to the
 *   voice length, gain-staged independently (defaults: 0 dB voice,
 *   −12 dB background) and **sidechain-compressed against the voice**
 *   so the bed dips during speech for a polished, podcast-style mix
 *   instead of a flat overlay (see {@link buildDuckingFilter}).
 * - Symmetric fade-in / fade-out (default 3 s) are applied to the
 *   final mix.
 * - Output: 128 kbps libmp3lame MP3, 44.1 kHz stereo, written to
 *   `${tmpdir}/hypnosleep-mix/${randomUUID()}.mp3`.
 *
 * @returns Absolute path to the mixed MP3. The caller owns the file and
 *   must `unlink` it when finished.
 * @throws {AppError} `GENERATION_FAILED` if FFmpeg fails. Any partial
 *   output file is cleaned up.
 */
export async function mixWithBackground(opts: MixOptions): Promise<string> {
  // Silence is a sentinel that skips the entire mix step. Returning
  // `voicePath` unchanged keeps the contract simple for the orchestrator
  // while letting callers pass the full `BackgroundSound` union without
  // a separate type guard.
  if (opts.background === 'silence') {
    return opts.voicePath;
  }

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

  const filter = buildDuckingFilter({
    voiceVolDb: voiceVol,
    bgVolDb: bgVol,
    voiceDurationSec: voiceDuration,
    fadeInSec: fadeIn,
    fadeOutSec: fadeOut,
    fadeOutStartSec: fadeOutStart,
  });

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
      '-ac', '2',
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
 * Builds the FFmpeg `-filter_complex` graph that ducks the background
 * loop against the voice using `sidechaincompress`.
 *
 * Pipeline:
 *
 *   [0:a] voice  ── volume ──┬─► [voice]   (carries forward to amix)
 *                            └─► [voicekey] (sidechain key signal)
 *
 *   [1:a] bg     ── volume ── aloop ── atrim ──► [bg]
 *
 *   [bg][voicekey] ── sidechaincompress ──► [ducked]
 *
 *   [voice][ducked] ── amix ──► afade(in) ── afade(out) ──► [out]
 *
 * The compressor parameters (`threshold=0.05`, `ratio=8`, `attack=20`,
 * `release=300`) give a gentle, slow-release duck that drops the bed
 * roughly 6–10 dB under normal-volume narration and recovers between
 * sentences — close to a typical podcast voice-over chain.
 */
function buildDuckingFilter(args: {
  voiceVolDb: number;
  bgVolDb: number;
  voiceDurationSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  fadeOutStartSec: number;
}): string {
  const {
    voiceVolDb,
    bgVolDb,
    voiceDurationSec,
    fadeInSec,
    fadeOutSec,
    fadeOutStartSec,
  } = args;
  const voiceDur = voiceDurationSec.toFixed(2);
  const fadeStart = fadeOutStartSec.toFixed(2);
  return [
    `[0:a]volume=${voiceVolDb}dB,aresample=44100,asplit=2[voice][voicekey]`,
    `[1:a]volume=${bgVolDb}dB,aloop=loop=-1:size=2e9,atrim=0:${voiceDur},aresample=44100[bg]`,
    `[bg][voicekey]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[ducked]`,
    `[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0[mixed]`,
    `[mixed]afade=t=in:st=0:d=${fadeInSec},afade=t=out:st=${fadeStart}:d=${fadeOutSec}[out]`,
  ].join(';');
}

/**
 * Crossfade between two background loops. Reserved for the multi-track
 * background feature (v2) where the bed transitions partway through a
 * session. Not exposed via the orchestrator yet.
 *
 * @internal
 */
// TODO: enable for v2
export async function crossfadeBackgrounds(
  _a: string,
  _b: string,
  _durationSec: number,
): Promise<string> {
  throw new AppError(
    'GENERATION_FAILED',
    'crossfadeBackgrounds is reserved for v2 multi-track sessions',
    501,
  );
}

/**
 * Probes a media file for its duration in seconds. Public wrapper around
 * the internal `ffprobe` helper, used by the orchestrator to compute the
 * final session duration.
 */
export async function probeDuration(path: string): Promise<number> {
  return probeDurationSec(path);
}

/**
 * Concatenates a sequence of MP3 files into a single MP3 using FFmpeg's
 * concat demuxer. Used to stitch together per-chunk Edge-TTS outputs
 * when a script is long enough that we want to synthesise it in pieces
 * (see {@link ./audio.tts.synthesizeVoiceChunks}).
 *
 * Re-encodes the output with `libmp3lame` at 128 kbps so callers get
 * a stream with uniform frame timing even when the inputs have slight
 * bitrate / timestamp drift.
 *
 * @returns Absolute path to the concatenated MP3. The caller owns the
 *   file and must `unlink` it when finished.
 * @throws {AppError} `GENERATION_FAILED` if FFmpeg fails.
 */
export async function concatMp3Files(inputPaths: string[]): Promise<string> {
  if (inputPaths.length === 0) {
    throw new AppError('GENERATION_FAILED', 'concatMp3Files called with no inputs', 500);
  }
  if (inputPaths.length === 1) {
    // Nothing to concat — return the single input unchanged. The
    // caller's cleanup path already owns it.
    return inputPaths[0];
  }

  const tmpDir = join(tmpdir(), 'hypnosleep-concat');
  await mkdir(tmpDir, { recursive: true });
  const listPath = join(tmpDir, `${randomUUID()}.txt`);
  const outPath = join(tmpDir, `${randomUUID()}.mp3`);

  // Escape single quotes in paths per FFmpeg concat demuxer rules.
  // See: https://ffmpeg.org/ffmpeg-formats.html#concat
  const listBody = inputPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n');
  await writeFile(listPath, listBody, 'utf8');

  try {
    await execa(
      'ffmpeg',
      [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c:a', 'libmp3lame',
        '-b:a', '128k',
        '-ar', '44100',
        outPath,
      ],
      { timeout: 180_000 },
    );
    logger.debug(
      { outPath, chunks: inputPaths.length },
      'Concatenated TTS chunks',
    );
    return outPath;
  } catch (err) {
    await unlink(outPath).catch(() => {});
    throw new AppError(
      'GENERATION_FAILED',
      `FFmpeg concat failed: ${(err as Error).message}`,
      500,
    );
  } finally {
    await unlink(listPath).catch(() => {});
  }
}
