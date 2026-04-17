import type { SessionStatus, SessionCategory, VoiceId, BackgroundSound } from '../../config/constants.js';

/** A hypnosis session record */
export interface Session {
  id: string;
  userId: string;
  title: string;
  scriptText: string | null;
  category: SessionCategory;
  durationSec: number;
  voiceId: VoiceId;
  backgroundSound: BackgroundSound;
  audioUrl: string | null;
  playCount: number;
  isTemplate: boolean;
  status: SessionStatus;
  createdAt: Date;
}

/** Input for creating a session record */
export interface CreateSessionInput {
  id: string;
  userId: string;
  title: string;
  category: SessionCategory;
  durationSec: number;
  voiceId: VoiceId;
  backgroundSound: BackgroundSound;
  status: SessionStatus;
}

/** Filters for listing sessions */
export interface ListSessionsFilter {
  userId: string;
  category?: SessionCategory;
  status?: SessionStatus;
  isTemplate?: boolean;
  page?: number;
  limit?: number;
}
