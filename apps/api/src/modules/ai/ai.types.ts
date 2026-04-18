import type { SessionCategory, InductionStyle, DepthLevel, VoiceId, BackgroundSound } from '../../config/constants.js';

/** Input for generating a new hypnosis session */
export interface GenerateSessionInput {
  userId: string;
  /**
   * Pre-allocated session row id. Optional for backwards compatibility
   * with older callers; when omitted the AI service will generate a
   * random UUID purely for audit-log correlation.
   */
  sessionId?: string;
  prompt: string;
  category: SessionCategory;
  voiceId: VoiceId;
  backgroundSound: BackgroundSound;
  durationMinutes: number;
  inductionStyle: InductionStyle;
  depthLevel: DepthLevel;
  wakeUpEnding: boolean;
}

/** Result from Gemini script generation */
export interface ScriptGenerationResult {
  scriptText: string;
  title: string;
  tokensInput: number;
  tokensOutput: number;
  generationMs: number;
}

/** Job data for BullMQ audio generation queue */
export interface AudioGenerationJobData {
  sessionId: string;
  userId: string;
  scriptText: string;
  title: string;
  voiceId: VoiceId;
  backgroundSound: BackgroundSound;
  durationMinutes: number;
  /**
   * Whether the requesting user is on the Pro plan. Used by the queue
   * to assign a higher BullMQ priority so paid users skip ahead of
   * free-tier work when both are pending.
   */
  isPro?: boolean;
}

/** Progress events emitted via SSE */
export interface GenerationProgressEvent {
  step: 'script' | 'voice' | 'mixing' | 'uploading' | 'complete' | 'failed';
  message: string;
  progress: number; // 0–100
  sessionId: string;
}

/** Safety check result */
export interface SafetyCheckResult {
  isSafe: boolean;
  reason?: string;
}
