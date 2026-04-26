/**
 * One-shot seed script that renders AI-scripted, voice-narrated,
 * background-mixed audio for every `is_template = true` session in
 * MySQL whose `status` is still `'generating'` or `'failed'` (so a
 * previously-failed run can be retried on the next deploy), then
 * flips it to `'ready'`.
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
import { eq, and, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mysqlDb } from '../src/db/mysql/client.js';
import { sessions } from '../src/db/mysql/schema/sessions.js';
import { generateScript } from '../src/modules/ai/ai.service.js';
import { generateAudio } from '../src/modules/audio/audio.service.js';
import { logger } from '../src/utils/logger.js';
import { getRedis } from '../src/db/redis/client.js';
import { AppError } from '../src/utils/errors.js';
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
  // Multi-replica guard: Railway runs this script from `startCommand`,
  // which is executed on **every** replica boot. Without coordination,
  // 4–6 replicas would race the same 12 templates through Gemini at
  // the same instant — combined with `generateScript`'s 3-attempt
  // retry loop, that produces a ~140-call burst per deploy and trips
  // the Tier-1 RPM/TPM caps, which is exactly the 429 storm we saw on
  // the Gemini usage dashboard.
  //
  // We take a short-lived Redis lock (`SET NX EX`) so only the first
  // replica per deploy actually seeds. Other replicas log and exit
  // cleanly. When Redis is not configured (local dev/tests), we fall
  // through to the unguarded path so existing behavior is preserved.
  const lock = await acquireSeedLock();
  if (lock.kind === 'busy') {
    logger.info(
      { holder: lock.holder },
      'Another replica is already seeding templates — skipping on this replica.',
    );
    return;
  }

  try {
    await runSeedLoop();
  } finally {
    if (lock.kind === 'acquired') {
      await releaseSeedLock(lock.token);
    }
  }
}

/**
 * Distributed lock key. A fixed name (rather than per-deploy) is
 * deliberate: Railway can re-run `startCommand` on the *same* deploy
 * (replica restart, autoscale event), and we want those reboots to
 * stay coordinated too. The 15-minute TTL is a safety net so a
 * crashed seeder cannot wedge subsequent deploys forever.
 */
const SEED_LOCK_KEY = 'seed-templates:lock';
const SEED_LOCK_TTL_SEC = 15 * 60;

type LockState =
  | { kind: 'acquired'; token: string }
  | { kind: 'busy'; holder: string | null }
  | { kind: 'unavailable' };

/**
 * Attempts to acquire the seed lock via `SET NX EX`. Returns:
 *  - `acquired` when this process owns the lock (caller must release),
 *  - `busy` when another replica holds it (caller should exit early),
 *  - `unavailable` when Redis is not configured or the SET call
 *    fails — in that case we fall through to the unguarded seed run
 *    so single-instance / local-dev environments still work.
 */
export async function acquireSeedLock(): Promise<LockState> {
  const redis = getRedis();
  if (!redis) {
    logger.warn(
      'REDIS_URL not set — running seed without distributed lock (fine for single-replica deployments).',
    );
    return { kind: 'unavailable' };
  }

  const token = randomUUID();
  try {
    const result = await redis.set(
      SEED_LOCK_KEY,
      token,
      'EX',
      SEED_LOCK_TTL_SEC,
      'NX',
    );
    if (result === 'OK') {
      logger.info({ ttlSec: SEED_LOCK_TTL_SEC }, 'Seed lock acquired');
      return { kind: 'acquired', token };
    }
    const holder = await redis.get(SEED_LOCK_KEY).catch(() => null);
    return { kind: 'busy', holder };
  } catch (err) {
    logger.warn(
      { err },
      'Failed to acquire seed lock via Redis — proceeding without lock',
    );
    return { kind: 'unavailable' };
  }
}

/**
 * Releases the seed lock if (and only if) we still own it. Uses a
 * standard compare-and-delete Lua script to avoid releasing a lock
 * that has already expired and been re-acquired by another replica.
 */
export async function releaseSeedLock(token: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const script =
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
  try {
    await redis.eval(script, 1, SEED_LOCK_KEY, token);
  } catch (err) {
    // Best-effort: a missed release just means the next deploy waits
    // for the TTL. Not worth failing the seed run over.
    logger.warn({ err }, 'Failed to release seed lock');
  }
}

async function runSeedLoop(): Promise<void> {
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
    // Retry rows that previously failed so a single bad run doesn't
    // permanently poison the library — idempotent because already-
    // `ready` rows are excluded and `seedOne` overwrites title /
    // script / audio / duration / status atomically.
    .where(
      and(
        eq(sessions.isTemplate, true),
        inArray(sessions.status, ['generating', 'failed']),
      ),
    );

  if (pending.length === 0) {
    logger.info('No pending templates — nothing to seed.');
    return;
  }

  logger.info({ count: pending.length }, 'Seeding pending templates');

  for (const row of pending) {
    try {
      await seedOne(row);
    } catch (err) {
      // If we've blown through the daily Gemini quota, every remaining
      // template is guaranteed to fail too — bail out early with a
      // clear message instead of pounding through the loop and
      // producing pages of identical 429 retry chatter.
      if (err instanceof AppError && err.code === 'QUOTA_EXHAUSTED') {
        logger.error(
          { err, remaining: pending.length - pending.indexOf(row) - 1 },
          'Gemini daily quota exhausted — stopping seed run. Re-run after the quota window resets or enable billing on the Gemini API project.',
        );
        await mysqlDb
          .update(sessions)
          .set({ status: 'failed' })
          .where(eq(sessions.id, row.id))
          .catch(() => {});
        break;
      }

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

// Only run when invoked directly (e.g. `tsx scripts/seed-templates.ts`)
// — not when this file is imported from a test for `acquireSeedLock`
// / `releaseSeedLock`.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href;

if (invokedDirectly) {
  main().then(
    () => process.exit(0),
    (err) => {
      logger.error({ err }, 'Template seeding run aborted');
      process.exit(1);
    },
  );
}
