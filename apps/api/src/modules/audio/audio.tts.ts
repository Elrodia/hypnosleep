import { execa } from 'execa';
import { mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Absolute path to the Python Edge-TTS subprocess script. Resolved from
 * the API working directory so it works in both `tsx` (development) and
 * the built/runtime container (where the `scripts/` directory is copied
 * alongside `dist/` — see `apps/api/Dockerfile`).
 */
const TTS_SCRIPT = join(process.cwd(), 'scripts', 'tts.py');

/** Options for {@link synthesizeVoice}. */
export interface TtsOptions {
  /** Edge-TTS voice identifier, e.g. `en-US-AnaNeural`. */
  voiceId: string;
  /** Plain text or SSML to synthesize. Sent over stdin to avoid argv limits. */
  text: string;
  /** Speech rate, e.g. `-15%` for the slower hypnosis cadence. */
  rate?: string;
  /** Pitch adjustment, e.g. `-2Hz` for a calmer tone. */
  pitch?: string;
}

/**
 * Generates a voice MP3 using Microsoft Edge TTS via the bundled Python
 * subprocess (`scripts/tts.py`). The text is streamed to the subprocess
 * over stdin so it is not subject to OS argv length limits.
 *
 * The caller owns the returned file and must `unlink` it when finished.
 *
 * @returns Absolute path to the generated MP3.
 * @throws {AppError} `GENERATION_FAILED` if the subprocess exits non-zero
 *   or otherwise fails. Any partially-written output file is cleaned up.
 */
export async function synthesizeVoice(opts: TtsOptions): Promise<string> {
  const tmpDir = join(tmpdir(), 'hypnosleep-tts');
  await mkdir(tmpDir, { recursive: true });
  const outPath = join(tmpDir, `${randomUUID()}.mp3`);

  try {
    const { stderr, exitCode } = await execa(
      'python3',
      [
        TTS_SCRIPT,
        '--voice', opts.voiceId,
        '--output', outPath,
        '--rate', opts.rate ?? '-15%',
        '--pitch', opts.pitch ?? '-2Hz',
      ],
      {
        input: opts.text,
        timeout: 120_000, // 2 minutes max
        encoding: 'utf8',
        reject: false,
      },
    );

    if (exitCode !== 0) {
      throw new AppError(
        'GENERATION_FAILED',
        `TTS subprocess failed: ${(stderr ?? '').toString().slice(0, 500)}`,
        500,
      );
    }

    logger.debug({ outPath, voiceId: opts.voiceId }, 'TTS synthesis complete');
    return outPath;
  } catch (err) {
    // Cleanup partial file on error
    await unlink(outPath).catch(() => {});
    if (err instanceof AppError) throw err;
    throw new AppError(
      'GENERATION_FAILED',
      `TTS failed: ${(err as Error).message}`,
      500,
    );
  }
}
