/**
 * Audio pipeline integration test.
 *
 * Exercises the full TTS → FFmpeg mix → (local) flow. Requires a Docker
 * environment with `python3`, `edge-tts`, and `ffmpeg` installed, plus
 * outbound network access to the Edge TTS endpoint.
 *
 * Skipped by default to keep `npm test` hermetic in CI / contributor
 * machines. Enable by running:
 *
 *   SKIP_INTEGRATION=false npm test
 */
import { describe, it, expect } from 'vitest';
import { stat, unlink } from 'node:fs/promises';
import { synthesizeVoice } from '../../../src/modules/audio/audio.tts.js';

const skip = (process.env.SKIP_INTEGRATION ?? 'true') !== 'false';
const describeIntegration = skip ? describe.skip : describe;

describeIntegration('audio pipeline integration', () => {
  it(
    'synthesizes a short voice clip with Edge TTS',
    async () => {
      const out = await synthesizeVoice({
        voiceId: 'en-US-AnaNeural',
        text: 'This is a test of the hypnosleep audio pipeline.',
      });
      try {
        const info = await stat(out);
        expect(info.size).toBeGreaterThan(1000);
      } finally {
        await unlink(out).catch(() => {});
      }
    },
    60_000,
  );
});
