import { useEffect, useRef } from 'react'
import { useKV } from '@/hooks/use-kv'

/**
 * Local-only daily reminder using the browser's Notification API.
 *
 * Why not push notifications?
 * ---------------------------
 * The infra cost of a real push pipeline (VAPID keys, FCM/APNs
 * brokering, per-user subscription rows, retry queue) is way out of
 * proportion for "remind me to do my session at 22:00". Web
 * Notifications fired by the page itself cover the actual user
 * promise — a daily nudge while the app is reachable — and degrade
 * gracefully when the tab is closed (the next app open will catch
 * up if the time has already passed today).
 *
 * Behaviour
 * ---------
 * - Reads `daily-reminder-enabled` and `reminder-time` (HH:MM) from
 *   the KV hook (mirrors PreferencesPage).
 * - Requests notification permission on first enable; if the user
 *   denies, we silently fall back (no infinite re-prompts — that's
 *   exactly the kind of UX the platform punishes).
 * - Schedules a single timeout for the next occurrence of the
 *   configured local time. After firing it re-arms for the next day.
 * - On settings change (toggle off, time edit) cancels the pending
 *   timeout and re-arms with the new value.
 * - Persists the last-fired ISO date in localStorage so a reload
 *   on the same day doesn't double-notify.
 */

function nextOccurrenceMs(hh: number, mm: number, now = new Date()): number {
  const target = new Date(now)
  target.setHours(hh, mm, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime() - now.getTime()
}

function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const FIRED_KEY = 'hypno-reminder-last-fired'

export function DailyReminderScheduler() {
  const [enabled] = useKV<boolean>('daily-reminder-enabled', false)
  const [time] = useKV<string>('reminder-time', '22:00')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!enabled) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return

    const [hhStr, mmStr] = (time ?? '22:00').split(':')
    const hh = Number.parseInt(hhStr, 10)
    const mm = Number.parseInt(mmStr, 10)
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return

    // Permission may already be granted from a previous enable; only
    // prompt on the first opt-in. Denied permissions are honored
    // silently — we never re-prompt.
    const ensurePermission = async (): Promise<boolean> => {
      if (Notification.permission === 'granted') return true
      if (Notification.permission === 'denied') return false
      try {
        const result = await Notification.requestPermission()
        return result === 'granted'
      } catch {
        return false
      }
    }

    let cancelled = false

    const arm = () => {
      const delay = nextOccurrenceMs(hh, mm)
      timerRef.current = window.setTimeout(async () => {
        if (cancelled) return
        // Avoid double-firing on same day if the schedule re-armed
        // (e.g. user toggled, page reloaded, etc).
        const today = todayKey()
        let lastFired: string | null = null
        try {
          lastFired = localStorage.getItem(FIRED_KEY)
        } catch {
          /* ignore */
        }
        if (lastFired !== today) {
          if (await ensurePermission()) {
            try {
              new Notification('Time for your hypnosis session', {
                body: 'A few minutes today keeps the streak alive.',
                tag: 'hypno-daily-reminder',
              })
            } catch {
              /* ignore — some browsers throw on bg tab */
            }
          }
          try {
            localStorage.setItem(FIRED_KEY, today)
          } catch {
            /* ignore */
          }
        }
        // Re-arm for tomorrow.
        if (!cancelled) arm()
      }, delay)
    }

    // Best-effort prompt on enable so the user sees the OS dialog
    // immediately rather than at the surprise moment of fire.
    void ensurePermission()
    arm()

    return () => {
      cancelled = true
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [enabled, time])

  return null
}
