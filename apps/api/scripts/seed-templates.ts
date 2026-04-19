/**
 * One-shot seed script that renders AI-scripted, voice-narrated,
 * background-mixed audio for every `is_template = true` session in
 * MySQL whose `status` is still `'generating'`, then flips it to
 * `'ready'`.
 *
 * Intended to be run **once per deploy** after migrations have applied
 * (`0002_seed_templates` creates the rows without audio). Running it
 * again is safe — rows already marked `'ready'` are skipped.
 *
 * Usage (from `apps/api/`):
 *
 *   npx tsx scripts/seed-templates.ts
 *
 * Required env (same as the API runtime):
 *   - DATABASE_URL_MYSQL
 *   - S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY
 *   - GEMINI_API_KEY
 *
 * The script does **not** start the BullMQ worker — it inlines the
 * same `ai.service.generateScript` + `audio.service.generateAudio`
 * pipeline synchronously, one template at a time, so you can run it
 * from a deploy hook even when no Redis worker is up.
 *
 * Load any required env (DATABASE_URL_MYSQL etc.) via your process
 * manager or `--env-file .env` (Node ≥ 20) before running.
 */
import { eq, and } from 'drizzle-orm';
import { mysqlDb } from '../src/db/mysql/client.js';
import { sessions } from '../src/db/mysql/schema/sessions.js';
import { generateScript } from '../src/modules/ai/ai.service.js';
import { generateAudio } from '../src/modules/audio/audio.service.js';
import { logger } from '../src/utils/logger.js';
import type {
  SessionCategory,
  VoiceId,
  BackgroundSound,
  InductionStyle,
  DepthLevel,
} from '../src/config/constants.js';

/**
 * A short, focused user prompt per template. Gemini expands these
 * into full 10–20 minute scripts via `generateScript`. Keeping the
 * prompts terse (rather than shipping hand-written scripts) keeps the
 * seed data in sync with any future prompt/template changes.
 */
const TEMPLATE_PROMPTS: Record<string, string> = {
  '11111111-1111-1111-1111-000000000001':
    'Help me fall into deep restful sleep, release the stress of the day, and sleep through the night.',
  '11111111-1111-1111-1111-000000000002':
    'Guide me into sleep with the image of gentle ocean waves washing my worries away.',
  '11111111-1111-1111-1111-000000000003':
    'A peaceful forest walk at dusk that ends with deep, nourishing sleep.',
  '22222222-2222-2222-2222-000000000001':
    'Build a calm, unshakeable inner confidence that carries me through any challenge.',
  '22222222-2222-2222-2222-000000000002':
    'Relaxing preparation for a big presentation or interview tomorrow — calm, focused, ready.',
  '33333333-3333-3333-3333-000000000001':
    'Release my fear of public speaking and rewire my reaction to being in front of a crowd.',
  '33333333-3333-3333-3333-000000000002':
    'Quiet the anxious mind, slow racing thoughts, and return to steady presence.',
  '44444444-4444-4444-4444-000000000001':
    'Break the habit of reaching for sugar when I am stressed or tired.',
  '44444444-4444-4444-4444-000000000002':
    'Reset my relationship with screens so I naturally reach for them less.',
  '55555555-5555-5555-5555-000000000001':
    'A short deep-work primer that drops me into laser focus for the next hour.',
  '55555555-5555-5555-5555-000000000002':
    'Sustain a deep focused flow state for the afternoon without burning out.',
  '55555555-5555-5555-5555-000000000003':
    'A morning focus reset to start the workday clear-headed and intentional.',
};

async function seedOne(row: {
  id: string;
  userId: string;
  title: string;
  category: SessionCategory;
  durationSec: number;
  voiceId: string;
  backgroundSound: string | null;
}): Promise<void> {
  const prompt = TEMPLATE_PROMPTS[row.id];
  if (!prompt) {
    logger.warn({ id: row.id }, 'No template prompt — skipping');
    return;
  }

  // Guard against zero-duration rows: the Zod schema for generation
  // requires ≥ 5-minute sessions (`MIN_SESSION_DURATION_SEC`), so we
  // clamp to the same floor here in case a seed row was inserted
  // with a shorter duration.
  const durationMinutes = Math.max(5, Math.round(row.durationSec / 60));
  const background = (row.backgroundSound ?? 'silence') as BackgroundSound;

  logger.info({ id: row.id, title: row.title }, 'Seeding template');

  // Step 1: script. Re-uses the live prompt builder so the seed
  // content is stylistically identical to user-generated content.
  const script = await generateScript({
    userId: row.userId,
    sessionId: row.id,
    prompt,
    category: row.category,
    voiceId: row.voiceId as VoiceId,
    backgroundSound: background,
    durationMinutes,
    inductionStyle: 'progressive' as InductionStyle,
    depthLevel: 'medium' as DepthLevel,
    wakeUpEnding: row.category !== 'sleep', // sleep templates end silent
  });

  // Step 2: audio. `audioKey` is written to `audio_url` (same
  // convention as the runtime worker — presigned URLs are minted on
  // demand by `getAudioUrl`).
  const audio = await generateAudio({
    userId: row.userId,
    sessionId: row.id,
    scriptText: script.scriptText,
    voiceId: row.voiceId,
    background,
  });

  // Step 3: flip the row to `ready` with real title, script, duration.
  await mysqlDb
    .update(sessions)
    .set({
      title: script.title || row.title,
      scriptText: script.scriptText,
      durationSec: audio.durationSec,
      audioUrl: audio.audioKey,
      status: 'ready',
    })
    .where(eq(sessions.id, row.id));

  logger.info(
    { id: row.id, audioKey: audio.audioKey, durationSec: audio.durationSec },
    'Template seeded',
  );
}

async function main(): Promise<void> {
  const pending = await mysqlDb
    .select({
      id: sessions.id,
      userId: sessions.userId,
      title: sessions.title,
      category: sessions.category,
      durationSec: sessions.durationSec,
      voiceId: sessions.voiceId,
      backgroundSound: sessions.backgroundSound,
    })
    .from(sessions)
    .where(and(eq(sessions.isTemplate, true), eq(sessions.status, 'generating')));

  if (pending.length === 0) {
    logger.info('No pending templates — nothing to seed.');
    return;
  }

  logger.info({ count: pending.length }, 'Seeding pending templates');

  for (const row of pending) {
    try {
      await seedOne(row);
    } catch (err) {
      // Mark the individual row failed so subsequent deploys don't
      // keep retrying a template with a broken prompt, but keep going
      // through the rest.
      logger.error({ err, id: row.id }, 'Failed to seed template');
      await mysqlDb
        .update(sessions)
        .set({ status: 'failed' })
        .where(eq(sessions.id, row.id))
        .catch(() => {});
    }
  }

  logger.info('Template seeding run complete.');
}

main().then(
  () => process.exit(0),
  (err) => {
    logger.error({ err }, 'Template seeding run aborted');
    process.exit(1);
  },
);
