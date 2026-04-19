-- Seed ~12 template hypnosis sessions so Library's empty state and
-- Home's "Popular this week" rail have real content from day 0.
--
-- These rows are created with a synthetic `system` user as owner and
-- the `is_template` flag set, which makes them readable by every
-- authenticated user (see `getSessionById` / `listSessions`). They are
-- inserted with `status = 'generating'` and `audio_url = NULL`; a
-- one-shot seeding script (`apps/api/scripts/seed-templates.ts`) then
-- renders the audio for each row at deploy time and flips them to
-- `status = 'ready'`. The migration itself is deliberately audio-free
-- so it can run without Edge TTS / R2 credentials.
--
-- Re-running this migration on a partially-seeded DB is safe: each
-- row is inserted with `INSERT IGNORE` keyed on its deterministic
-- UUID, so repeat runs are no-ops.

-- Ensure the synthetic owner row exists before we reference it.
INSERT IGNORE INTO `users`
  (`id`, `oauth_provider`, `oauth_id`, `email`, `name`, `avatar_url`, `plan`, `referral_code`)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'google',
    '__system__',
    'system+templates@hypnosleep.local',
    'Hypnosleep Templates',
    NULL,
    'pro',
    'SYSTEMTPL'
  );
--> statement-breakpoint

-- Sleep — 3 templates
INSERT IGNORE INTO `sessions`
  (`id`, `user_id`, `title`, `category`, `duration_sec`, `voice_id`, `background_sound`, `audio_url`, `play_count`, `is_template`, `status`)
VALUES
  ('11111111-1111-1111-1111-000000000001', '00000000-0000-0000-0000-000000000001', 'Deep Restful Sleep',       'sleep',     900, 'en-US-AnaNeural', 'rain',   NULL, 0, true, 'generating'),
  ('11111111-1111-1111-1111-000000000002', '00000000-0000-0000-0000-000000000001', 'Drift Off to the Ocean',  'sleep',    1200, 'en-US-AnaNeural', 'ocean',  NULL, 0, true, 'generating'),
  ('11111111-1111-1111-1111-000000000003', '00000000-0000-0000-0000-000000000001', 'Forest Sleep Journey',     'sleep',     900, 'en-US-AnaNeural', 'forest', NULL, 0, true, 'generating');
--> statement-breakpoint

-- Confidence — 2 templates
INSERT IGNORE INTO `sessions`
  (`id`, `user_id`, `title`, `category`, `duration_sec`, `voice_id`, `background_sound`, `audio_url`, `play_count`, `is_template`, `status`)
VALUES
  ('22222222-2222-2222-2222-000000000001', '00000000-0000-0000-0000-000000000001', 'Unshakeable Confidence',   'confidence', 900, 'en-US-AnaNeural', 'wind',       NULL, 0, true, 'generating'),
  ('22222222-2222-2222-2222-000000000002', '00000000-0000-0000-0000-000000000001', 'Calm Before a Big Day',    'confidence', 600, 'en-US-AnaNeural', 'ocean',      NULL, 0, true, 'generating');
--> statement-breakpoint

-- Fears / Anxiety — 2 templates (maps to the shared "fears" category +
-- the newly added "anxiety" category in the enum)
INSERT IGNORE INTO `sessions`
  (`id`, `user_id`, `title`, `category`, `duration_sec`, `voice_id`, `background_sound`, `audio_url`, `play_count`, `is_template`, `status`)
VALUES
  ('33333333-3333-3333-3333-000000000001', '00000000-0000-0000-0000-000000000001', 'Release Public Speaking Fear', 'fears',   900, 'en-US-AnaNeural', 'rain',        NULL, 0, true, 'generating'),
  ('33333333-3333-3333-3333-000000000002', '00000000-0000-0000-0000-000000000001', 'Quiet the Anxious Mind',       'anxiety', 900, 'en-US-AnaNeural', 'white_noise', NULL, 0, true, 'generating');
--> statement-breakpoint

-- Habits — 2 templates
INSERT IGNORE INTO `sessions`
  (`id`, `user_id`, `title`, `category`, `duration_sec`, `voice_id`, `background_sound`, `audio_url`, `play_count`, `is_template`, `status`)
VALUES
  ('44444444-4444-4444-4444-000000000001', '00000000-0000-0000-0000-000000000001', 'Break the Sugar Habit',    'habits',  900, 'en-US-AnaNeural', 'forest', NULL, 0, true, 'generating'),
  ('44444444-4444-4444-4444-000000000002', '00000000-0000-0000-0000-000000000001', 'Reset Your Screen Time',   'habits',  600, 'en-US-AnaNeural', 'wind',   NULL, 0, true, 'generating');
--> statement-breakpoint

-- Focus — 3 templates
INSERT IGNORE INTO `sessions`
  (`id`, `user_id`, `title`, `category`, `duration_sec`, `voice_id`, `background_sound`, `audio_url`, `play_count`, `is_template`, `status`)
VALUES
  ('55555555-5555-5555-5555-000000000001', '00000000-0000-0000-0000-000000000001', 'Laser Focus Session',      'focus',   600, 'en-US-AnaNeural', 'white_noise', NULL, 0, true, 'generating'),
  ('55555555-5555-5555-5555-000000000002', '00000000-0000-0000-0000-000000000001', 'Deep Work Flow State',     'focus',   900, 'en-US-AnaNeural', 'rain',        NULL, 0, true, 'generating'),
  ('55555555-5555-5555-5555-000000000003', '00000000-0000-0000-0000-000000000001', 'Morning Focus Reset',      'focus',   600, 'en-US-AnaNeural', 'forest',      NULL, 0, true, 'generating');
