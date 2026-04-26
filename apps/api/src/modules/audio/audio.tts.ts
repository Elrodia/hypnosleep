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
        // Use `--name=value` form (single argv token) for rate/pitch.
        // Their values commonly start with `-` (e.g. `-15%`, `-2Hz`),
        // and Python's argparse rejects them when passed as two tokens
        // because it interprets a leading `-` as another option.
        `--rate=${opts.rate ?? '-15%'}`,
        `--pitch=${opts.pitch ?? '-2Hz'}`,
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

/**
 * Conservative upper bound on characters per Edge-TTS chunk. Rough
 * mapping: Edge TTS speaks at roughly 150 words/min, one English word
 * ≈ 5.5 chars (with spaces), so 2000 chars ≈ 2.4 minutes of audio —
 * comfortably inside the 120-second subprocess timeout even with some
 * network jitter. Longer paragraphs are split on sentence boundaries.
 */
const MAX_CHUNK_CHARS = 2000;

/**
 * Splits a multi-paragraph hypnosis script into TTS-sized chunks.
 *
 * The canonical paragraph separator is a blank line (`\n\n`), as
 * produced by {@link ../ai/ai.prompts.buildScriptPrompt}. Paragraphs
 * that still exceed {@link MAX_CHUNK_CHARS} are further split on
 * sentence endings so no single chunk ever overflows Edge TTS's per-call
 * budget. Empty paragraphs are dropped.
 *
 * Exported so callers (worker, tests) can reason about chunk counts
 * without re-implementing the heuristic.
 */
export function splitScriptIntoChunks(
  text: string,
  maxChars = MAX_CHUNK_CHARS,
): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      chunks.push(p);
      continue;
    }
    // Long paragraph: split on sentence terminators while preserving
    // the punctuation. Fall back to a hard char split if no sentence
    // boundaries exist (e.g. a single run-on sentence).
    const sentences = p.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [p];
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > maxChars && buf.length > 0) {
        chunks.push(buf.trim());
        buf = '';
      }
      if (s.length > maxChars) {
        // Single sentence bigger than the cap: hard-split by chars.
        let rest = s;
        while (rest.length > maxChars) {
          chunks.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars);
        }
        buf += rest;
      } else {
        buf += s;
      }
    }
    if (buf.trim().length > 0) chunks.push(buf.trim());
  }
  return chunks;
}

/**
 * Callback invoked after each TTS chunk completes, so the worker can
 * emit SSE progress updates. `index` is 0-based; `total` is the final
 * chunk count.
 */
export type ChunkProgressCallback = (
  index: number,
  total: number,
) => void | Promise<void>;

/**
 * Synthesises a long script by chunking it and calling Edge TTS once
 * per chunk. Chunks are synthesised sequentially (Edge TTS's fair-use
 * policy discourages heavy concurrency from a single IP) and the
 * caller is notified after each one completes.
 *
 * @returns An array of absolute paths to per-chunk MP3 files, in
 *   script order. The caller owns every returned file and must
 *   `unlink` them when finished. On error, any files synthesised so
 *   far are cleaned up before the error is re-thrown.
 */
export async function synthesizeVoiceChunks(
  chunks: string[],
  opts: Omit<TtsOptions, 'text'>,
  onChunkDone?: ChunkProgressCallback,
): Promise<string[]> {
  if (chunks.length === 0) {
    throw new AppError('GENERATION_FAILED', 'Cannot synthesise voice: script is empty', 500);
  }
  const paths: string[] = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const path = await synthesizeVoice({ ...opts, text: chunks[i] });
      paths.push(path);
      if (onChunkDone) {
        // Errors in the progress callback must not fail the job.
        try {
          await onChunkDone(i, chunks.length);
        } catch (err) {
          logger.warn({ err, index: i }, 'Chunk progress callback threw');
        }
      }
    }
    return paths;
  } catch (err) {
    // Clean up any partial outputs before propagating.
    for (const p of paths) {
      await unlink(p).catch(() => {});
    }
    throw err;
  }
}
