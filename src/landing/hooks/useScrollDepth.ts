import { useEffect, useRef } from 'react'
import { posthog } from '../lib/posthog'

/**
 * Fires `landing_scroll_depth` exactly once per session for each of the
 * 25 / 50 / 75 / 100% milestones. Milestones are persisted to sessionStorage
 * so they survive remounts and reloads within the same tab — otherwise a
 * route change or hot reload would re-fire the same milestones.
 */
const STORAGE_KEY = 'hs_landing_scroll_depth_fired'

function readFired(): Set<number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((n): n is number => typeof n === 'number'))
    }
  } catch {
    /* storage may be blocked or the payload corrupt — start fresh */
  }
  return new Set()
}

function persistFired(fired: Set<number>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...fired]))
  } catch {
    /* ignore — storage may be blocked */
  }
}

export function useScrollDepth() {
  const fired = useRef<Set<number>>(new Set())

  useEffect(() => {
    fired.current = readFired()

    const milestones = [25, 50, 75, 100]

    const onScroll = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - doc.clientHeight
      if (scrollable <= 0) return
      const pct = Math.round((window.scrollY / scrollable) * 100)

      let changed = false
      for (const m of milestones) {
        if (pct >= m && !fired.current.has(m)) {
          fired.current.add(m)
          changed = true
          posthog.capture('landing_scroll_depth', { depth: m })
        }
      }
      if (changed) persistFired(fired.current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}
