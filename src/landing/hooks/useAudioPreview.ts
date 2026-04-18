import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny wrapper around an <audio> element so the hero can show a single
 * "Listen to Sample" toggle. The audio element is lazy-created on first play
 * to keep the initial HTML small. Any error falls back to a silent stop so
 * we never block the UI if the sample file 404s.
 *
 * The element (and its listeners) is recreated whenever `src` changes, and
 * is fully torn down on unmount to avoid lingering handlers or
 * setState-after-unmount warnings.
 */
export function useAudioPreview(src: string, maxSeconds = 15) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Release any previously-created audio element + listeners.
  const teardown = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    const el = audioRef.current
    if (el) {
      el.pause()
      // Drop the source so the browser can GC the media resource.
      el.removeAttribute('src')
      el.load()
    }
    audioRef.current = null
  }, [])

  // If `src` changes, drop the old element so the next toggle uses the new
  // URL. Without this the hook would keep playing the first URL it saw.
  useEffect(() => {
    teardown()
    setIsPlaying(false)
    setError(null)
  }, [src, teardown])

  // Final unmount cleanup — removes listeners registered in `toggle`.
  useEffect(() => () => { teardown() }, [teardown])

  const stop = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
    setIsPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio(src)
      el.preload = 'none'

      const onEnded = () => setIsPlaying(false)
      const onTimeUpdate = () => {
        if (el.currentTime >= maxSeconds) {
          el.pause()
          el.currentTime = 0
          setIsPlaying(false)
        }
      }
      const onError = () => {
        setError('Sample unavailable')
        setIsPlaying(false)
      }
      el.addEventListener('ended', onEnded)
      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('error', onError)

      cleanupRef.current = () => {
        el.removeEventListener('ended', onEnded)
        el.removeEventListener('timeupdate', onTimeUpdate)
        el.removeEventListener('error', onError)
      }

      audioRef.current = el
    }

    const el = audioRef.current
    if (isPlaying) {
      el.pause()
      setIsPlaying(false)
      return
    }

    el.play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setError('Sample unavailable')
        setIsPlaying(false)
      })
  }, [src, maxSeconds, isPlaying])

  return { isPlaying, toggle, stop, error }
}
