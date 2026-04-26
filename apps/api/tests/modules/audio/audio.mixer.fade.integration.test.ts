/**
 * Integration test for the 3-second fade-in / fade-out applied by
 * `mixWithBackground` (see C.10).
 *
 * Generates a deterministic 8-second sine voice + 8-second pink-noise
 * background loop on disk via FFmpeg's `lavfi` source filter, runs the
 * real mixer, and probes the resulting MP3 with the `astats` filter to
 * assert:
 *
 *   - First 100 ms RMS < −40 dB  (silent at fade-in start)
 *   - First 3 s peak rises monotonically (fade-in is actually ramping)
 *   - Last 100 ms RMS < −40 dB   (silent at fade-out end)
 *
 * Requires `ffmpeg` and `ffprobe` on PATH plus a writable `tmpdir`, so
 * the test is skipped by default and opted-in with
 * `SKIP_INTEGRATION=false npm test`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execa } from 'execa';
import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const skip = (process.env.SKIP_INTEGRATION ?? 'true') !== 'false';
const describeIntegration = skip ? describe.skip : describe;

/**
 * Probes a slice of an audio file with `astats` and returns the
 * peak/RMS levels in dB for that window.
 */
async function probeWindow(
  inputPath: string,
  startSec: number,
  durationSec: number,
): Promise<{ peakDb: number; rmsDb: number }> {
  const { stderr } = await execa('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-ss', startSec.toFixed(3),
    '-t', durationSec.toFixed(3),
    '-i', inputPath,
    '-af', 'astats=metadata=0:reset=0',
    '-f', 'null',
    '-',
  ], { reject: false });

  // `astats` reports per-channel and overall stats. We grep the
  // overall lines after the per-channel block: they are the LAST
  // occurrences in the log.
  const peakMatches = [...stderr.matchAll(/Peak level dB:\s*(-?\d+\.?\d*|-inf)/g)];
  const rmsMatches = [...stderr.matchAll(/RMS level dB:\s*(-?\d+\.?\d*|-inf)/g)];
  const parse = (raw: string): number => (raw === '-inf' ? -Infinity : parseFloat(raw));
  if (peakMatches.length === 0 || rmsMatches.length === 0) {
    throw new Error(`astats produced no level lines for ${inputPath}@${startSec}s+${durationSec}s\n${stderr}`);
  }
  return {
    peakDb: parse(peakMatches[peakMatches.length - 1][1]),
    rmsDb: parse(rmsMatches[rmsMatches.length - 1][1]),
  };
}

describeIntegration('mixWithBackground fade in/out', () => {
  let workDir: string;
  let voicePath: string;
  let bgDir: string;
  let bgPath: string;
  let originalCwd: string;
  let mixWithBackground: typeof import('../../../src/modules/audio/audio.mixer.js').mixWithBackground;
  let outputPath: string | null = null;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'hypnosleep-fade-test-'));

    // Synthesise an 8-second sine "voice" so the mixer has real audio
    // to work with. 8s > 2 * 3s fade so the in/out windows don't
    // overlap.
    voicePath = join(workDir, 'voice.mp3');
    await execa('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:sample_rate=44100:duration=8',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      voicePath,
    ]);

    // Synthesise a 10-second pink-noise loop file in a directory
    // matching the mixer's `BG_DIR` convention (cwd/assets/backgrounds).
    bgDir = join(workDir, 'assets', 'backgrounds');
    await execa('mkdir', ['-p', bgDir]);
    bgPath = join(bgDir, 'rain.mp3');
    await execa('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'anoisesrc=color=pink:sample_rate=44100:duration=10',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      bgPath,
    ]);

    originalCwd = process.cwd();
    process.chdir(workDir);
    ({ mixWithBackground } = await import('../../../src/modules/audio/audio.mixer.js'));
  }, 60_000);

  afterAll(async () => {
    if (originalCwd) process.chdir(originalCwd);
    if (outputPath) await unlink(outputPath).catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it(
    'applies symmetric 3s fade-in / fade-out to the mixed output',
    async () => {
      outputPath = await mixWithBackground({
        voicePath,
        background: 'rain',
      });

      // First 100 ms should be effectively silent (fade-in just started).
      const head = await probeWindow(outputPath, 0, 0.1);
      expect(head.rmsDb).toBeLessThan(-40);

      // Last 100 ms (after the 3s fade-out completes at t=8s) should
      // also be effectively silent.
      const tail = await probeWindow(outputPath, 7.9, 0.1);
      expect(tail.rmsDb).toBeLessThan(-40);

      // Sample the first 3 seconds of the fade-in in 500 ms windows
      // and assert the peak level rises overall. Fade ramps are
      // mathematically monotonic but compressed audio adds some
      // jitter, so we require monotonic non-decrease with a small
      // tolerance, plus a healthy total rise (>= 20 dB) from the
      // first window to the last.
      const peaks: number[] = [];
      for (let t = 0; t < 3; t += 0.5) {
        const w = await probeWindow(outputPath, t, 0.5);
        peaks.push(w.peakDb);
      }
      const tolerance = 1.5; // dB
      for (let i = 1; i < peaks.length; i++) {
        expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1] - tolerance);
      }
      expect(peaks[peaks.length - 1] - peaks[0]).toBeGreaterThan(20);
    },
    180_000,
  );

  it('returns voicePath unchanged when background is silence', async () => {
    const out = await mixWithBackground({
      voicePath,
      background: 'silence',
    });
    expect(out).toBe(voicePath);
  });

  // Touch unused fixture writer so TS doesn't strip the import.
  void writeFile;
});
