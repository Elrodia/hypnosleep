import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for `concatMp3Files`.
 *
 * The function is responsible for stitching per-chunk Edge-TTS outputs
 * back into a single playable MP3 via FFmpeg's concat demuxer. Two
 * properties matter for correctness and security:
 *
 *  1. The list-file MUST be escaped per the FFmpeg concat-demuxer
 *     rules (single quotes around each path, embedded single quotes
 *     escaped as `'\''`) so paths with quotes/spaces don't break the
 *     parse or open injection paths.
 *  2. The 0/1/N input cases must behave correctly: 0 throws, 1 returns
 *     the single input unchanged (no FFmpeg invocation), N invokes
 *     FFmpeg exactly once.
 */

// Capture every execa invocation so individual tests can assert the
// command line the function would have run, plus the list-file body
// at the moment ffmpeg "ran" (before the function deletes it in
// `finally`).
const execaCalls: Array<{ cmd: string; args: readonly string[] }> = [];
let lastListBody: string | undefined;
/**
 * Default mock duration returned by ffprobe. Tests can override per-call
 * with `nextProbeDuration`, which is consumed once and resets to this.
 */
const DEFAULT_PROBE_DURATION = '5.00';
let nextProbeDuration: string | null = null;
const execaMock = vi.fn(async (cmd: string, args: readonly string[]) => {
  execaCalls.push({ cmd, args });
  const iIdx = args.indexOf('-i');
  if (iIdx >= 0) {
    const { readFile } = await import('node:fs/promises');
    try {
      lastListBody = await readFile(args[iIdx + 1], 'utf8');
    } catch {
      lastListBody = undefined;
    }
  }
  if (cmd === 'ffprobe') {
    const stdout = nextProbeDuration ?? DEFAULT_PROBE_DURATION;
    nextProbeDuration = null;
    return { stdout, stderr: '', exitCode: 0 };
  }
  return { stdout: '', stderr: '', exitCode: 0 };
});

vi.mock('execa', () => ({
  execa: (cmd: string, args: readonly string[]) => execaMock(cmd, args),
}));

// Import AFTER the mock so the SUT picks up the mocked execa.
const { concatMp3Files, mixWithBackground, crossfadeBackgrounds } = await import(
  '../../../src/modules/audio/audio.mixer.js'
);

beforeEach(() => {
  execaCalls.length = 0;
  lastListBody = undefined;
  nextProbeDuration = null;
  execaMock.mockClear();
});

describe('concatMp3Files', () => {
  it('throws when called with no inputs', async () => {
    await expect(concatMp3Files([])).rejects.toThrow(/no inputs/i);
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('returns the single input unchanged and skips FFmpeg for 1 input', async () => {
    const out = await concatMp3Files(['/tmp/only-chunk.mp3']);
    expect(out).toBe('/tmp/only-chunk.mp3');
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('invokes ffmpeg once for N inputs and returns a fresh output path', async () => {
    const inputs = ['/tmp/a.mp3', '/tmp/b.mp3', '/tmp/c.mp3'];
    const out = await concatMp3Files(inputs);

    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaCalls[0].cmd).toBe('ffmpeg');
    // Output path is a fresh tmp file, NOT one of the inputs.
    expect(inputs).not.toContain(out);
    expect(out.endsWith('.mp3')).toBe(true);

    // Sanity: the args should reference the concat demuxer and the
    // generated output path.
    expect(execaCalls[0].args).toContain('-f');
    expect(execaCalls[0].args).toContain('concat');
    expect(execaCalls[0].args).toContain(out);
  });

  it('escapes single quotes in the list file per ffmpeg concat rules', async () => {
    const tricky = "/tmp/it's a chunk.mp3";

    await concatMp3Files([tricky, '/tmp/plain.mp3']);

    expect(lastListBody).toBeDefined();
    // Each entry must be quoted; the embedded apostrophe must be
    // escaped as `'\''` per https://ffmpeg.org/ffmpeg-formats.html#concat
    expect(lastListBody).toContain("file '/tmp/it'\\''s a chunk.mp3'");
    expect(lastListBody).toContain("file '/tmp/plain.mp3'");
  });

  it('passes paths with spaces through to the list file unmodified', async () => {
    await concatMp3Files(['/tmp/with space.mp3', '/tmp/another one.mp3']);

    expect(lastListBody).toBeDefined();
    expect(lastListBody).toContain("file '/tmp/with space.mp3'");
    expect(lastListBody).toContain("file '/tmp/another one.mp3'");
  });

  it('wraps ffmpeg failures as AppError(GENERATION_FAILED)', async () => {
    execaMock.mockImplementationOnce(async () => {
      throw new Error('ffmpeg crashed');
    });

    await expect(
      concatMp3Files(['/tmp/a.mp3', '/tmp/b.mp3']),
    ).rejects.toMatchObject({
      code: 'GENERATION_FAILED',
    });
  });
});

describe('mixWithBackground', () => {
  it('returns voicePath unchanged for silence (no FFmpeg invocation)', async () => {
    const out = await mixWithBackground({
      voicePath: '/tmp/voice.mp3',
      background: 'silence',
    });
    expect(out).toBe('/tmp/voice.mp3');
    expect(execaMock).not.toHaveBeenCalled();
  });

  it('builds a ducking filter graph and emits a libmp3lame 128k MP3', async () => {
    nextProbeDuration = '12.50';

    const out = await mixWithBackground({
      voicePath: '/tmp/voice.mp3',
      background: 'rain',
    });

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(execaCalls[0].cmd).toBe('ffprobe');
    expect(execaCalls[1].cmd).toBe('ffmpeg');

    const ffmpegArgs = execaCalls[1].args;
    // Output spec
    expect(ffmpegArgs).toContain('libmp3lame');
    expect(ffmpegArgs).toContain('128k');
    expect(ffmpegArgs).toContain('44100');

    // Filter graph contains the sidechain ducking + symmetric fades.
    const filterIdx = ffmpegArgs.indexOf('-filter_complex');
    expect(filterIdx).toBeGreaterThanOrEqual(0);
    const filter = ffmpegArgs[filterIdx + 1];
    expect(filter).toContain('asplit=2[voice][voicekey]');
    expect(filter).toContain('aloop=loop=-1:size=2e9');
    expect(filter).toContain('atrim=0:12.50');
    expect(filter).toContain('sidechaincompress=');
    expect(filter).toContain('amix=inputs=2:duration=first:dropout_transition=0');
    expect(filter).toContain('afade=t=in:st=0:d=3');
    // 12.5s voice − 3s fade-out = 9.50s fade-out start.
    expect(filter).toContain('afade=t=out:st=9.50:d=3');

    // Output path is a fresh tmp .mp3.
    expect(out.endsWith('.mp3')).toBe(true);
  });

  it('clamps fade-out start to 0 when voice is shorter than fadeOut', async () => {
    nextProbeDuration = '1.00';

    await mixWithBackground({
      voicePath: '/tmp/short.mp3',
      background: 'rain',
      fadeInSec: 3,
      fadeOutSec: 3,
    });

    const filter = execaCalls[1].args[execaCalls[1].args.indexOf('-filter_complex') + 1];
    expect(filter).toContain('afade=t=out:st=0.00:d=3');
  });

  it('wraps ffmpeg mix failures as AppError(GENERATION_FAILED)', async () => {
    nextProbeDuration = '5.00';
    // Let ffprobe succeed, then make ffmpeg throw on the next call.
    execaMock.mockImplementationOnce(async (cmd: string, args: readonly string[]) => {
      execaCalls.push({ cmd, args });
      return { stdout: '5.00', stderr: '', exitCode: 0 };
    });
    execaMock.mockImplementationOnce(async (cmd: string, args: readonly string[]) => {
      execaCalls.push({ cmd, args });
      throw new Error('ffmpeg crashed');
    });

    await expect(
      mixWithBackground({ voicePath: '/tmp/voice.mp3', background: 'rain' }),
    ).rejects.toMatchObject({ code: 'GENERATION_FAILED' });
  });
});

describe('crossfadeBackgrounds', () => {
  it('is stubbed for v2 and rejects with GENERATION_FAILED', async () => {
    await expect(
      crossfadeBackgrounds('/tmp/a.mp3', '/tmp/b.mp3', 5),
    ).rejects.toMatchObject({ code: 'GENERATION_FAILED' });
  });
});
