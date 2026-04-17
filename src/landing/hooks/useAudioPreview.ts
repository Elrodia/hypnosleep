import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tiny wrapper around an <audio> element so the hero can show a single
 * "Listen to Sample" toggle. The audio element is lazy-created on first play
 * to keep the initial HTML small. Any error falls back to a silent stop so
 * we never block the UI if the sample file 404s.
 */
export function useAudioPreview(src: string, maxSeconds = 15) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      el.addEventListener('ended', () => setIsPlaying(false))
      el.addEventListener('timeupdate', () => {
        if (el.currentTime >= maxSeconds) {
          el.pause()
          el.currentTime = 0
          setIsPlaying(false)
        }
      })
      el.addEventListener('error', () => {
        setError('Sample unavailable')
        setIsPlaying(false)
      })
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

  useEffect(() => () => { audioRef.current?.pause() }, [])

  return { isPlaying, toggle, stop, error }
}
