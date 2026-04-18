/**
 * Shared helpers for mapping backend session rows (`SessionSummary` /
 * `SessionDetail`) onto the UI shape the page components already expect.
 *
 * Kept as a single module so every call site uses the same category
 * label and gradient conventions.
 */

import type { SessionSummary } from '@/lib/api-endpoints'

/**
 * Gradient picker keyed by the (capitalised) category label. Falls
 * back to a neutral gradient for unknown categories.
 */
export const CATEGORY_GRADIENTS: Record<string, string> = {
  Sleep: 'from-indigo-600 to-purple-600',
  Confidence: 'from-purple-600 to-indigo-600',
  Fears: 'from-violet-600 to-violet-700',
  Habits: 'from-blue-600 to-blue-700',
  Focus: 'from-teal-600 to-teal-700',
  Anxiety: 'from-violet-500 to-fuchsia-600',
  Custom: 'from-fuchsia-600 to-fuchsia-700',
}

/** Capitalise a backend lowercase category slug: `sleep` → `Sleep`. */
export function formatCategory(raw: string): string {
  if (!raw) return 'Custom'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

/** Render a duration in seconds as `N min` for UI display. */
export function formatDurationMin(sec: number): string {
  const mins = Math.max(1, Math.round(sec / 60))
  return `${mins} min`
}

/**
 * Shape expected by `SessionCard` / `SwipeableSessionCard` and a few
 * other UI components written against the old local-only model.
 */
export interface UISession {
  id: string
  title: string
  category: string
  duration: string
  gradient: string
  playCount: number
  createdAt: number
  isFavorited: boolean
  status: 'generating' | 'ready' | 'failed'
}

export function toUISession(s: SessionSummary): UISession {
  const category = formatCategory(s.category)
  return {
    id: s.id,
    title: s.title,
    category,
    duration: formatDurationMin(s.durationSec),
    gradient: CATEGORY_GRADIENTS[category] ?? 'from-purple-600 to-indigo-600',
    playCount: s.playCount,
    createdAt: new Date(s.createdAt).getTime(),
    isFavorited: s.favorited,
    status: s.status,
  }
}
