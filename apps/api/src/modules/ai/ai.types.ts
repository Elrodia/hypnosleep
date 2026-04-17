import type { SessionCategory, InductionStyle, DepthLevel, VoiceId, BackgroundSound } from '../../config/constants.js';

/** Input for generating a new hypnosis session */
export interface GenerateSessionInput {
  userId: string;
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
