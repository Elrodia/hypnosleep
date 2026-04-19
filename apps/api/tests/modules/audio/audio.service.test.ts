import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for `generateAudio`.
 *
 * The orchestrator has three behaviours we want to lock in beyond the
 * happy path:
 *
 *  1. Chunked TTS progress percent mapping — when a script splits into
 *     multiple chunks, the per-chunk callback should report percentages
 *     that interpolate linearly between TTS_START (20) and TTS_END (50).
 *  2. Background-missing graceful degradation — if the requested
 *     background asset is absent on disk, the pipeline must fall back
 *     to a voice-only mix instead of failing the whole job.
 *  3. `onProgress` callback errors must be swallowed so a buggy
 *     subscriber can never fail an in-flight generation.
 */

// ── Mocks for every IO boundary the service touches ───────────────────

const synthesizeVoice = vi.fn(async () => '/tmp/voice-single.mp3');
const synthesizeVoiceChunks = vi.fn(
  async (
    chunks: string[],
    _opts: unknown,
    onChunkDone?: (i: number, total: number) => void | Promise<void>,
  ) => {
    const out: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      out.push(`/tmp/chunk-${i}.mp3`);
      if (onChunkDone) await onChunkDone(i, chunks.length);
    }
    return out;
  },
);
// Real chunker — we want to exercise the real splitting heuristic so
// the percent-mapping assertions reflect production behaviour. Loaded
// via `vi.importActual` so we don't recurse into the mock below.
const ttsActual = await vi.importActual<
  typeof import('../../../src/modules/audio/audio.tts.js')
>('../../../src/modules/audio/audio.tts.js');
const realSplit = ttsActual.splitScriptIntoChunks;

vi.mock('../../../src/modules/audio/audio.tts.js', () => ({
  synthesizeVoice: (...a: unknown[]) =>
    (synthesizeVoice as unknown as (...x: unknown[]) => unknown)(...a),
  synthesizeVoiceChunks: (...a: unknown[]) =>
    (synthesizeVoiceChunks as unknown as (...x: unknown[]) => unknown)(...a),
  splitScriptIntoChunks: (text: string, max?: number) => realSplit(text, max),
}));

const mixWithBackground = vi.fn(async () => '/tmp/mixed.mp3');
const probeDuration = vi.fn(async () => 12.7);
const concatMp3Files = vi.fn(async (paths: string[]) => {
  if (paths.length === 1) return paths[0];
  return '/tmp/concatenated.mp3';
});

vi.mock('../../../src/modules/audio/audio.mixer.js', () => ({
  mixWithBackground: (...a: unknown[]) =>
    (mixWithBackground as unknown as (...x: unknown[]) => unknown)(...a),
  probeDuration: (...a: unknown[]) =>
    (probeDuration as unknown as (...x: unknown[]) => unknown)(...a),
  concatMp3Files: (...a: unknown[]) =>
    (concatMp3Files as unknown as (...x: unknown[]) => unknown)(...a),
}));

const uploadFile = vi.fn(async () => undefined);
const buildSessionKey = vi.fn(
  (userId: string, sessionId: string) => `audio/${userId}/${sessionId}.mp3`,
);
vi.mock('../../../src/modules/audio/audio.s3.js', () => ({
  uploadFile: (...a: unknown[]) =>
    (uploadFile as unknown as (...x: unknown[]) => unknown)(...a),
  buildSessionKey: (...a: unknown[]) =>
    (buildSessionKey as unknown as (...x: unknown[]) => unknown)(...a),
}));

// fs.access controls the background-missing branch; fs.stat / unlink
// are happy-path fakes.
let accessShouldSucceed = true;
vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>(
    'node:fs/promises',
  );
  return {
    ...actual,
    access: vi.fn(async () => {
      if (!accessShouldSucceed) throw new Error('ENOENT');
    }),
    stat: vi.fn(async () => ({ size: 4096 })),
    unlink: vi.fn(async () => undefined),
  };
});

// Import the SUT AFTER all mocks are registered.
const { generateAudio } = await import(
  '../../../src/modules/audio/audio.service.js'
);

beforeEach(() => {
  synthesizeVoice.mockClear();
  synthesizeVoiceChunks.mockClear();
  mixWithBackground.mockClear();
  probeDuration.mockClear();
  concatMp3Files.mockClear();
  uploadFile.mockClear();
  accessShouldSucceed = true;
});

describe('generateAudio', () => {
  it('maps chunked TTS progress linearly between 20% and 50%', async () => {
    // Force ~3 chunks by using a script with 3 paragraphs that each
    // already fit comfortably under the chunker cap.
    const script = ['Para one.', 'Para two.', 'Para three.'].join('\n\n');

    const ttsPercents: number[] = [];
    await generateAudio({
      userId: 'u1',
      sessionId: 's1',
      scriptText: script,
      voiceId: 'en-US-AnaNeural',
      background: 'silence',
      onProgress: ({ step, percent }) => {
        if (step === 'tts') ttsPercents.push(percent);
      },
    });

    // First emit is the pre-chunk announce at TTS_START (20),
    // followed by one emit per chunk interpolated up to TTS_END (50).
    expect(ttsPercents[0]).toBe(20);
    expect(ttsPercents[ttsPercents.length - 1]).toBe(50);
    // Strictly non-decreasing.
    for (let i = 1; i < ttsPercents.length; i++) {
      expect(ttsPercents[i]).toBeGreaterThanOrEqual(ttsPercents[i - 1]);
    }
    // All within the [20, 50] band.
    for (const p of ttsPercents) {
      expect(p).toBeGreaterThanOrEqual(20);
      expect(p).toBeLessThanOrEqual(50);
    }
  });

  it('falls back to voice-only when the background asset is missing', async () => {
    accessShouldSucceed = false;

    const steps: string[] = [];
    const result = await generateAudio({
      userId: 'u1',
      sessionId: 's1',
      scriptText: 'A short single-chunk script.',
      voiceId: 'en-US-AnaNeural',
      background: 'rain',
      onProgress: ({ step }) => {
        steps.push(step);
      },
    });

    // Mix step must NOT have run.
    expect(mixWithBackground).not.toHaveBeenCalled();
    expect(steps).not.toContain('mix');
    // Pipeline still produced a usable result.
    expect(result.audioKey).toBe('audio/u1/s1.mp3');
    expect(result.durationSec).toBe(13); // Math.round(12.7)
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('still mixes when the background asset is present', async () => {
    accessShouldSucceed = true;

    await generateAudio({
      userId: 'u1',
      sessionId: 's1',
      scriptText: 'A short single-chunk script.',
      voiceId: 'en-US-AnaNeural',
      background: 'rain',
    });

    expect(mixWithBackground).toHaveBeenCalledTimes(1);
  });

  it('skips mix and access check entirely for background "silence"', async () => {
    await generateAudio({
      userId: 'u1',
      sessionId: 's1',
      scriptText: 'A short single-chunk script.',
      voiceId: 'en-US-AnaNeural',
      background: 'silence',
    });
    expect(mixWithBackground).not.toHaveBeenCalled();
  });

  it('swallows errors thrown from onProgress without failing the job', async () => {
    const result = await generateAudio({
      userId: 'u1',
      sessionId: 's1',
      scriptText: 'A short single-chunk script.',
      voiceId: 'en-US-AnaNeural',
      background: 'silence',
      onProgress: () => {
        throw new Error('subscriber blew up');
      },
    });

    // Pipeline still completed and uploaded normally.
    expect(result.audioKey).toBe('audio/u1/s1.mp3');
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('throws GENERATION_FAILED when the script chunker yields no chunks', async () => {
    await expect(
      generateAudio({
        userId: 'u1',
        sessionId: 's1',
        scriptText: '   \n\n   ',
        voiceId: 'en-US-AnaNeural',
        background: 'silence',
      }),
    ).rejects.toMatchObject({ code: 'GENERATION_FAILED' });
  });
});
