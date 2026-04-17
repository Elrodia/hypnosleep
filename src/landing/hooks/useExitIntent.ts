import { useEffect } from 'react'

/**
 * Triggers `onTrigger` when the mouse leaves the viewport through the top edge
 * — the classic "about to close the tab" signal. Desktop only (pointer:fine).
 * Consumers should guard against multiple fires themselves (e.g. sessionStorage).
 */
export function useExitIntent(onTrigger: () => void) {
  useEffect(() => {
    // Skip on touch devices: `mouseleave` is noisy there and there is no
    // meaningful "exit intent" gesture on mobile.
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(pointer: coarse)').matches) return

    let triggered = false
    const handler = (e: MouseEvent) => {
      if (triggered) return
      if (e.clientY < 10 && e.relatedTarget === null) {
        triggered = true
        onTrigger()
      }
    }
    document.addEventListener('mouseleave', handler)
    return () => document.removeEventListener('mouseleave', handler)
  }, [onTrigger])
}
