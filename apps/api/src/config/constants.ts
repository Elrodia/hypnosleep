/** Rate limit windows and max requests */
export const RATE_LIMITS = {
  /** Global API rate limit: requests per minute per IP */
  API_GLOBAL: { window: 60, max: 100 },
  /** Auth routes: requests per minute per IP */
  AUTH: { window: 60, max: 10 },
  /** AI generation: max per month for free users */
  AI_GENERATION_FREE: 3,
} as const;

/** Available TTS voices mapped to Edge TTS voice identifiers */
export const VOICES = {
  'en-US-AnaNeural': { label: 'Calm Female', pro: false },
  'en-US-GuyNeural': { label: 'Deep Male', pro: false },
  'en-GB-SoniaNeural': { label: 'Gentle British', pro: true },
  'en-AU-NatashaNeural': { label: 'Warm Australian', pro: true },
  'en-US-AriaNeural': { label: 'Soft Whisper', pro: true },
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
