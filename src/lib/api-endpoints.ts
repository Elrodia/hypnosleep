/**
 * Typed endpoint helpers — one function per backend route we consume.
 *
 * Keeping these in a single module (instead of co-locating them with
 * pages) means every endpoint has a single typed signature and a
 * single React-Query key, and schema changes only need to touch one
 * file.
 */

import { apiFetch, qs } from './api'
import { getAuthToken } from './auth'

// ─────────────────────────────────────────────────────────────────────
// Auth / profile
// ─────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  goals?: string[]
  preferredTime?: 'before_sleep' | 'morning' | 'breaks' | 'anytime'
  defaultDuration?: number
  defaultVoice?: string
  defaultBackground?: string
  theme?: 'dark' | 'light'
  dailyReminderTime?: string
  /** Mirror of the local onboarding flag so a returning user skips splash. */
  hasCompletedOnboarding?: boolean
  /** Mirror of the local quiz flag so the quiz isn't shown twice. */
  hasCompletedQuiz?: boolean
  /** UI language preference (ISO 639-1). When set, overrides
   *  client-side detection on subsequent loads / new devices. */
  language?: 'en' | 'fr' | 'pt' | 'es' | 'de' | 'it'
}

export interface ProfileUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  plan: 'free' | 'pro'
  preferences: UserPreferences | null
  referralCode: string | null
  referredBy: string | null
  createdAt: string
}

export function getProfile(): Promise<ProfileUser> {
  return apiFetch<ProfileUser>('/api/profile')
}

export function updateProfile(input: {
  name?: string
  avatarUrl?: string
  preferences?: Partial<UserPreferences>
}): Promise<ProfileUser> {
  return apiFetch<ProfileUser>('/api/profile', { method: 'PATCH', body: input })
}

export async function exportProfile(): Promise<Blob> {
  // This endpoint streams a JSON attachment. Call fetch directly to get
  // the raw blob rather than passing through the envelope unwrapper.
  const token = getAuthToken()
  const res = await fetch('/api/profile/export', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) {
    throw new Error(`Export failed (HTTP ${res.status})`)
  }
  return res.blob()
}

export function deleteProfile(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/profile', { method: 'DELETE' })
}

// ─────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────

export type SessionStatus = 'generating' | 'ready' | 'failed'
export type SessionCategory =
  | 'sleep'
  | 'confidence'
  | 'fears'
  | 'habits'
  | 'focus'
  | 'anxiety'
  | 'custom'
  | string

export interface SessionSummary {
  id: string
  title: string
  category: string
  durationSec: number
  status: SessionStatus
  voiceId: string
  background: string
  playCount: number
  favorited: boolean
  createdAt: string
}

export interface SessionDetail extends SessionSummary {
  userPrompt: string
  scriptText: string | null
  inductionStyle: string
  depthLevel: string
  wakeUpAtEnd: boolean
  audioKey: string | null
  isTemplate: boolean
}

export interface ListMeta {
  page: number
  limit: number
  total: number
}

export interface ListEnvelope<T> {
  data: T[]
  meta: ListMeta
}

export interface ListSessionsParams {
  category?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'most_played' | 'shortest' | 'longest'
  favoritesOnly?: boolean
  includeTemplates?: boolean
  page?: number
  limit?: number
}

export function listSessions(
  params: ListSessionsParams = {},
): Promise<ListEnvelope<SessionSummary>> {
  return apiFetch<ListEnvelope<SessionSummary>>(
    `/api/sessions${qs(params as Record<string, string | number | boolean | undefined>)}`,
    { withMeta: true },
  )
}

export function getTrendingSessions(): Promise<SessionSummary[]> {
  return apiFetch<SessionSummary[]>('/api/sessions/trending')
}

export function getSession(id: string): Promise<SessionDetail> {
  return apiFetch<SessionDetail>(`/api/sessions/${encodeURIComponent(id)}`)
}

export interface GenerateSessionInput {
  userPrompt: string
  durationMin: number
  voiceId: string
  inductionStyle: string
  depthLevel: string
  wakeUpAtEnd: boolean
  background: string
  category: string
}

export function generateSession(
  input: GenerateSessionInput,
): Promise<{ sessionId: string; status: 'generating' }> {
  return apiFetch<{ sessionId: string; status: 'generating' }>(
    '/api/sessions/generate',
    { method: 'POST', body: input },
  )
}

export function getSessionAudioUrl(id: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/api/sessions/${encodeURIComponent(id)}/audio`)
}

export function deleteSession(id: string): Promise<void> {
  return apiFetch<void>(`/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function toggleSessionFavorite(id: string): Promise<{ favorited: boolean }> {
  return apiFetch<{ favorited: boolean }>(
    `/api/sessions/${encodeURIComponent(id)}/favorite`,
    { method: 'POST' },
  )
}

export function recordSessionPlay(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/sessions/${encodeURIComponent(id)}/play`, {
    method: 'POST',
  })
}

export function editSessionScript(
  id: string,
  scriptText: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/sessions/${encodeURIComponent(id)}/script`, {
    method: 'PUT',
    body: { scriptText },
  })
}

export function regenerateSessionAudio(
  id: string,
  body: { voiceId?: string; background?: string } = {},
): Promise<{ sessionId: string; status: string }> {
  return apiFetch<{ sessionId: string; status: string }>(
    `/api/sessions/${encodeURIComponent(id)}/regenerate`,
    { method: 'POST', body },
  )
}

// ─────────────────────────────────────────────────────────────────────
// Progress
// ─────────────────────────────────────────────────────────────────────

export interface ProgressStats {
  totalSessions: number
  totalMinutes: number
  currentStreak: number
  longestStreak: number
}

export function getProgressStats(): Promise<ProgressStats> {
  return apiFetch<ProgressStats>('/api/progress/stats')
}

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  lastListenDate: string | null
}

export function getStreak(): Promise<StreakInfo> {
  return apiFetch<StreakInfo>('/api/progress/streak')
}

export interface HeatmapPoint {
  date: string
  count: number
}

export function getHeatmap(days = 90): Promise<HeatmapPoint[]> {
  return apiFetch<HeatmapPoint[]>(`/api/progress/heatmap${qs({ days })}`)
}

export interface MoodTrendPoint {
  date: string
  avgRating: number
  count: number
}

export function getMoodTrend(days = 30): Promise<MoodTrendPoint[]> {
  return apiFetch<MoodTrendPoint[]>(`/api/progress/mood-trend${qs({ days })}`)
}

export function logMood(input: {
  sessionId: string
  rating: number
  note?: string
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/progress/mood-log', {
    method: 'POST',
    body: input,
  })
}

export interface WeeklyInsight {
  insight: string
  weekStart: string
}

export function getWeeklyInsight(): Promise<WeeklyInsight> {
  return apiFetch<WeeklyInsight>('/api/progress/weekly-insight')
}

// ─────────────────────────────────────────────────────────────────────
// Subscription
// ─────────────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  plan: 'free' | 'pro'
  status: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiFetch<SubscriptionStatus>('/api/subscription/status')
}

export function createCheckoutSession(input: {
  priceId?: string
  plan?: 'monthly' | 'yearly'
}): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/subscription/checkout', {
    method: 'POST',
    body: input,
  })
}

export function createPortalSession(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/api/subscription/portal', { method: 'POST' })
}

export function cancelSubscription(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/subscription/cancel', { method: 'POST' })
}

// ─────────────────────────────────────────────────────────────────────
// Sessions — report + cancel-generation
// ─────────────────────────────────────────────────────────────────────

export type SessionReportReason =
  | 'inappropriate'
  | 'inaccurate'
  | 'unsafe'
  | 'low_quality'
  | 'other'

export function reportSession(
  id: string,
  reason: SessionReportReason,
  details?: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/sessions/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    body: { reason, details: details ?? '' },
  })
}

/**
 * Server-side cancellation of an in-flight generation. Sets a Redis
 * abort flag the worker checks at each step so the queued audio job
 * stops as soon as it can.
 */
export function cancelSessionGeneration(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/sessions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  })
}

// ─────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string
  type: 'session_ready' | 'reminder' | 'weekly_insight' | 'system'
  title: string
  body: string
  createdAt: string
  readAt: string | null
  url?: string | null
}

export function listNotifications(): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>('/api/notifications')
}

export function markNotificationRead(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'POST',
  })
}

export function markAllNotificationsRead(): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/api/notifications/read-all', { method: 'POST' })
}
