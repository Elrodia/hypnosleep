/**
 * Smoke-tests every TTS voice in the {@link VOICES} registry by
 * synthesising the same hypnosis sample script with each one and
 * writing the resulting MP3 into `apps/api/test-output/voices/`.
 *
 * For each voice the script prints:
 *   - synthesis wall-clock duration (ms)
 *   - output file size (bytes)
 *   - SHA-256 checksum of the MP3
 *
 * Usage (from `apps/api/`):
 *
 *   npx tsx scripts/test-voices.ts
 *
 * Requires `python3` with `edge-tts` installed (same prerequisite as
 * the runtime API), since synthesis is delegated to `scripts/tts.py`
 * via {@link synthesizeVoice}.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { VOICES } from '../src/config/constants.js';
import { synthesizeVoice } from '../src/modules/audio/audio.tts.js';

/**
 * ~120 word hypnosis-cadence sample script (~50s at the default
 * `-15%` rate). Kept identical across voices so output MP3s are
 * directly comparable.
 */
const SAMPLE_SCRIPT = [
  'Welcome. Take a slow, easy breath in through your nose, and let it gently flow back out.',
  'With each breath, allow your body to soften. Your shoulders begin to drop, your jaw begins to release, and a quiet calm starts to settle through you.',
  'Notice the weight of your body resting where you are. Feel how supported you are, how safe it is to simply be still for a little while.',
  'As I count down from five, you may find yourself drifting deeper into a peaceful, restful state. Five… softer. Four… heavier. Three… slower. Two… quieter. One… completely at ease.',
  'There is nothing you need to do, nowhere you need to be. Just listen, breathe, and allow this calm to carry you gently inward.',
].join('\n\n');

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outDir = join(scriptDir, '..', 'test-output', 'voices');
  await mkdir(outDir, { recursive: true });

  const voiceIds = Object.keys(VOICES) as Array<keyof typeof VOICES>;
  console.log(`Synthesising sample script with ${voiceIds.length} voices → ${outDir}\n`);

  let failures = 0;
  for (const voiceId of voiceIds) {
    const finalPath = join(outDir, `${voiceId}.mp3`);
    const startedAt = Date.now();
    try {
      const tmpPath = await synthesizeVoice({
        voiceId,
        text: SAMPLE_SCRIPT,
        rate: '-15%',
        pitch: '-2Hz',
      });
      const durationMs = Date.now() - startedAt;

      // Move the tmp file produced by synthesizeVoice to its final
      // location so the caller can inspect/keep it.
      await unlink(finalPath).catch(() => {});
      await rename(tmpPath, finalPath);

      const [{ size }, buf] = await Promise.all([stat(finalPath), readFile(finalPath)]);
      const checksum = createHash('sha256').update(buf).digest('hex');

      console.log(`✓ ${voiceId} (${VOICES[voiceId].label})`);
      console.log(`    duration: ${durationMs} ms`);
      console.log(`    size:     ${size} bytes`);
      console.log(`    sha256:   ${checksum}\n`);
    } catch (err) {
      failures += 1;
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${voiceId} failed after ${durationMs} ms:`, message, '\n');
    }
  }

  if (failures > 0) {
    console.error(`${failures}/${voiceIds.length} voice(s) failed`);
    process.exit(1);
  }
  console.log(`All ${voiceIds.length} voices synthesised successfully.`);
}

main().catch((err) => {
  console.error('test-voices script crashed:', err);
  process.exit(1);
});
