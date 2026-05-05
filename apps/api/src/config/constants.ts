/** Rate limit windows and max requests */
export const RATE_LIMITS = {
  /** Global API rate limit: requests per minute per IP */
  API_GLOBAL: { window: 60, max: 100 },
  /** Auth routes: requests per minute per IP */
  AUTH: { window: 60, max: 10 },
  /** AI generation: max per month for free users */
  AI_GENERATION_FREE: 3,
} as const;

/** Available TTS voices mapped to Edge TTS voice identifiers.
 *
 * Free tier exposes a curated set of voices well-suited to hypnosis
 * and sleep (calm/soft/grounded). All voices are compatible with the
 * `eleven_turbo_v2_5` ElevenLabs model used in production. */
export const VOICES = {
  'en-US-AnaNeural': { label: 'Calm Female', pro: false },
  'en-US-GuyNeural': { label: 'Deep Male', pro: false },
  'en-US-AriaNeural': { label: 'Soft Whisper', pro: false },
  'en-AU-NatashaNeural': { label: 'Warm Australian', pro: false },
  'en-GB-SoniaNeural': { label: 'Gentle British', pro: true },
  'en-US-DavisNeural': { label: 'Steady Guide', pro: true },
} as const;

export type VoiceId = keyof typeof VOICES;

/** Available background sounds */
export const BACKGROUND_SOUNDS = ['rain', 'ocean', 'forest', 'wind', 'white_noise', 'silence'] as const;
export type BackgroundSound = (typeof BACKGROUND_SOUNDS)[number];

/** Session statuses */
export const SESSION_STATUSES = ['generating', 'ready', 'failed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Session categories */
export const SESSION_CATEGORIES = [
  'sleep',
  'confidence',
  'fears',
  'habits',
  'focus',
  'anxiety',
  'custom',
] as const;
export type SessionCategory = (typeof SESSION_CATEGORIES)[number];

/** Induction styles for hypnosis scripts */
export const INDUCTION_STYLES = ['progressive', 'countdown', 'body-scan'] as const;
export type InductionStyle = (typeof INDUCTION_STYLES)[number];

/** Depth levels for hypnosis sessions */
export const DEPTH_LEVELS = ['light', 'medium', 'deep'] as const;
export type DepthLevel = (typeof DEPTH_LEVELS)[number];

/** User plan types */
export const PLANS = ['free', 'pro'] as const;
export type Plan = (typeof PLANS)[number];

/** BullMQ queue names */
export const QUEUE_NAMES = {
  AUDIO_GENERATION: 'audio-generation',
} as const;

/** Max audio duration in seconds */
export const MAX_SESSION_DURATION_SEC = 1800; // 30 minutes

/** Min audio duration in seconds */
export const MIN_SESSION_DURATION_SEC = 300; // 5 minutes

/** Free tier preview duration in seconds */
export const FREE_PREVIEW_DURATION_SEC = 30;

/**
 * Single source of truth for per-plan limits enforced by
 * `createGenerationSession`. Calibrated for ~60% gross margin on
 * ElevenLabs Creator ($22 / 100k credits) at Turbo v2.5
 * (0.5 credit/char). If the project moves back to Multilingual v2
 * (1 credit/char), reduce `pro.sessionsPerMonth` to 5 and
 * `pro.maxDurationMin` to 10.
 */
export const PLAN_LIMITS = {
  free: {
    /** Total free-tier generations a user can ever create. */
    sessionsLifetime: 2,
    /** No monthly cap on free — the lifetime cap supersedes it. */
    sessionsPerMonth: null,
    /** Free tier is locked to a single duration. */
    minDurationMin: 5,
    maxDurationMin: 5,
    /** Curated voices available on free — calm/soft/grounded options
     *  tuned for hypnosis and sleep. All are compatible with
     *  `eleven_turbo_v2_5` (0.5 credit/char). */
    voicesAllowed: [
      'en-US-AnaNeural',
      'en-US-GuyNeural',
      'en-US-AriaNeural',
      'en-AU-NatashaNeural',
    ] as readonly string[],
    /** The two background sounds available on free. */
    backgroundsAllowed: ['silence', 'rain'] as readonly string[],
  },
  pro: {
    /** Pro users have no lifetime cap, only the monthly one. */
    sessionsLifetime: null,
    /** Monthly cap, calibrated for ~60% gross margin on Creator
     *  ($22/100k credits) with Turbo v2.5 (0.5 credit/char). */
    sessionsPerMonth: 8,
    /** Pro can pick any duration in this range. */
    minDurationMin: 3,
    maxDurationMin: 12,
    /** Sentinel meaning "no restriction; any value in `VOICES` is OK". */
    voicesAllowed: 'all' as const,
    /** Sentinel meaning "no restriction; any value in `BACKGROUND_SOUNDS` is OK". */
    backgroundsAllowed: 'all' as const,
  },
} as const;

export type PlanKey = keyof typeof PLAN_LIMITS;
