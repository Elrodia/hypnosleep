import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Static mapping from the Edge-TTS voice identifiers used throughout
 * the application (DB schema, Zod validators, Gemini prompts, and
 * `src/config/constants.ts`) to their ElevenLabs counterparts. The
 * upstream identifier format is preserved so the rest of the codebase
 * does not need to change; the translation happens entirely here.
 */
const EDGE_TO_ELEVENLABS_VOICE: Record<string, string> = {
  // Sarah — calm female
  'en-US-AnaNeural': 'EXAVITQu4vr4xnSDxMaL',
  // Adam — deep male
  'en-US-GuyNeural': 'pNInz6obpgDQGcFmaJgB',
  // Charlotte — British
  'en-GB-SoniaNeural': 'XB0fDUnXU5powFXDhCwa',
  // Matilda — Australian
  'en-AU-NatashaNeural': 'XrExE9yKIg1WjnnlVkGX',
  // Rachel — versatile
  'en-US-AriaNeural': '21m00Tcm4TlvDq8ikWAM',
  // Liam — steady
  'en-US-DavisNeural': 'TX3LPaxmHKxFdv7VOQHJ',
};

/** Options for {@link synthesizeVoice}. */
export interface TtsOptions {
  /**
   * Edge-TTS voice identifier, e.g. `en-US-AnaNeural`. Mapped internally
   * to an ElevenLabs voice id via {@link EDGE_TO_ELEVENLABS_VOICE}.
   */
  voiceId: string;
  /** Plain text or SSML to synthesize. */
  text: string;
  /**
   * Speech rate, e.g. `-15%` for the slower hypnosis cadence.
   *
   * @deprecated Silently ignored by the ElevenLabs implementation —
   * ElevenLabs exposes different controls (stability/similarity/style).
   * Kept for source-level compatibility with callers and the DB schema.
   */
  rate?: string;
  /**
   * Pitch adjustment, e.g. `-2Hz` for a calmer tone.
   *
   * @deprecated Silently ignored by the ElevenLabs implementation —
   * ElevenLabs exposes different controls (stability/similarity/style).
   * Kept for source-level compatibility with callers and the DB schema.
   */
  pitch?: string;
}

/**
 * Generates a voice MP3 by calling the ElevenLabs text-to-speech HTTP
 * API directly (no subprocess). The Edge-TTS-format `voiceId` on
 * {@link TtsOptions} is mapped to an ElevenLabs voice id via
 * {@link EDGE_TO_ELEVENLABS_VOICE}; unknown ids fail fast rather than
 * silently falling back to a default.
 *
 * The caller owns the returned file and must `unlink` it when finished.
 *
 * @returns Absolute path to the generated MP3.
 * @throws {AppError} `GENERATION_FAILED` if the API key is missing, the
 *   voice id is unknown, the HTTP call fails or times out, or the file
 *   write fails. Any partially-written output file is cleaned up.
 */
export async function synthesizeVoice(opts: TtsOptions): Promise<string> {
  const tmpDir = join(tmpdir(), 'hypnosleep-tts');
  await mkdir(tmpDir, { recursive: true });
  const outPath = join(tmpDir, `${randomUUID()}.mp3`);

  // Read ElevenLabs config directly from process.env: the env validator
  // (`apps/api/src/config/env.ts`) does not yet declare these vars. They
  // will be added in a follow-up step; until then, narrow here.
  const apiKey: string | undefined = process.env.ELEVENLABS_API_KEY;
  const modelId: string =
    process.env.ELEVENLABS_MODEL && process.env.ELEVENLABS_MODEL.length > 0
      ? process.env.ELEVENLABS_MODEL
      : 'eleven_multilingual_v2';

  if (!apiKey || apiKey.length === 0) {
    throw new AppError(
      'GENERATION_FAILED',
      'ElevenLabs API key not configured',
      500,
    );
  }

  const elevenLabsVoiceId = EDGE_TO_ELEVENLABS_VOICE[opts.voiceId];
  if (!elevenLabsVoiceId) {
    throw new AppError(
      'GENERATION_FAILED',
      `Unknown voice: ${opts.voiceId}`,
      500,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 minutes max

  try {
    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}` +
      `?output_format=mp3_44100_128`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: opts.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let body = '';
      try {
        body = await response.text();
      } catch {
        // Best-effort body decode — ignore failures.
      }
      throw new AppError(
        'GENERATION_FAILED',
        `ElevenLabs failed: ${response.status} ${body.slice(0, 500)}`,
        500,
      );
    }

    const buf = Buffer.from(await response.arrayBuffer());
    await writeFile(outPath, buf);

    logger.debug(
      {
        outPath,
        voiceId: opts.voiceId,
        elevenLabsVoiceId,
        bytes: buf.length,
      },
      'TTS synthesis complete',
    );
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
  } finally {
    clearTimeout(timeout);
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
