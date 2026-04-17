import { useEffect, useRef } from 'react'
import { posthog } from '../lib/posthog'

/**
 * Fires `landing_scroll_depth` exactly once per session for each of the
 * 25 / 50 / 75 / 100% milestones. Uses a ref so re-renders never double-fire.
 */
export function useScrollDepth() {
  const fired = useRef<Set<number>>(new Set())

  useEffect(() => {
    const milestones = [25, 50, 75, 100]

    const onScroll = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - doc.clientHeight
      if (scrollable <= 0) return
      const pct = Math.round((window.scrollY / scrollable) * 100)

      for (const m of milestones) {
        if (pct >= m && !fired.current.has(m)) {
          fired.current.add(m)
          posthog.capture('landing_scroll_depth', { depth: m })
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}
