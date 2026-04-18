import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useMediaSession } from '@/hooks/use-media-session'
import {
  getSessionAudioUrl,
  recordSessionPlay,
} from '@/lib/api-endpoints'
import { ApiError } from '@/lib/api'

/**
 * Global audio-playback context.
 *
 * Previously this was a fake ticker that incremented `progress` once a
 * second — there was no actual media element. It now owns a real
 * `<audio>` element, fetches a short-lived presigned S3 URL from the
 * backend each time `play()` is called, and records a play-completion
 * event via `POST /api/sessions/:id/play` so progress analytics and
 * streaks stay accurate.
 *
 * The context remains UI-agnostic: pages pass in a sessionId plus
 * display metadata (title/category/duration). If the sessionId is
 * omitted, playback runs locally against the provided metadata only —
 * useful for template/preview rows that haven't been generated yet.
 */

interface AudioPlayerState {
  isActive: boolean
  isPlaying: boolean
  sessionTitle: string
  category: string
  progress: number
  duration: number
  /** Sessions persisted on the backend have an id; templates do not. */
  sessionId: string | null
  /** `true` while we are fetching the presigned URL. */
  isLoading: boolean
  /** Non-null if the audio is pending generation. */
  pendingMessage: string | null
}

export interface PlayOptions {
  sessionId?: string
  title: string
  category?: string
  /** Seconds. Used as a UI fallback before metadata loads. */
  duration?: number
}

interface AudioPlayerContextType {
  player: AudioPlayerState
  /**
   * Start playback.
   *
   * Backward-compatible signature: `play(title)` still works for
   * callers that haven't been migrated to real session ids yet.
   */
  play: (titleOrOpts: string | PlayOptions, category?: string, duration?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  setProgress: (progress: number | ((prev: number) => number)) => void
  togglePlayPause: () => void
  showFeedback: boolean
  setShowFeedback: (show: boolean) => void
  completedSession: { title: string; duration: number } | null
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

const INITIAL_STATE: AudioPlayerState = {
  isActive: false,
  isPlaying: false,
  sessionTitle: '',
  category: '',
  progress: 0,
  duration: 0,
  sessionId: null,
  isLoading: false,
  pendingMessage: null,
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<AudioPlayerState>(INITIAL_STATE)
  const [showFeedback, setShowFeedback] = useState(false)
  const [completedSession, setCompletedSession] = useState<{ title: string; duration: number } | null>(null)

  /**
   * Single shared `<audio>` element so that `play()` after a previous
   * session cleanly takes over the same tag rather than stacking
   * multiple simultaneous streams.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null)
  if (audioRef.current === null && typeof window !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'
  }

  // Whether we've already recorded the completion for this session, so
  // repeated end/seek-past-end callbacks don't double-count plays.
  const recordedSessionIdRef = useRef<string | null>(null)

  const play = useCallback(
    (titleOrOpts: string | PlayOptions, category = 'Session', duration = 600) => {
      const opts: PlayOptions =
        typeof titleOrOpts === 'string'
          ? { title: titleOrOpts, category, duration }
          : titleOrOpts

      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }

      recordedSessionIdRef.current = null

      setPlayer({
        isActive: true,
        isPlaying: false,
        sessionTitle: opts.title,
        category: opts.category ?? 'Session',
        progress: 0,
        duration: opts.duration ?? 600,
        sessionId: opts.sessionId ?? null,
        isLoading: Boolean(opts.sessionId),
        pendingMessage: null,
      })

      // Template/preview callers don't have a sessionId — there's
      // nothing to fetch, so we stay in the "active but not playing"
      // state and let the UI show the fallback timer.
      if (!opts.sessionId || !audio) return

      void (async () => {
        try {
          const { url } = await getSessionAudioUrl(opts.sessionId!)
          audio.src = url
          try {
            await audio.play()
            setPlayer((prev) => ({ ...prev, isLoading: false, isPlaying: true }))
          } catch {
            // Autoplay may be blocked — the UI play button still works.
            setPlayer((prev) => ({ ...prev, isLoading: false, isPlaying: false }))
          }
        } catch (err) {
          // `SESSION_NOT_READY` / 409 indicates the audio is still
          // being generated. Surface a friendly message and leave the
          // UI in a paused-but-active state so the user can retry.
          if (err instanceof ApiError && (err.code === 'SESSION_NOT_READY' || err.status === 409)) {
            setPlayer((prev) => ({
              ...prev,
              isLoading: false,
              isPlaying: false,
              pendingMessage: 'Audio is still generating — try again in a moment.',
            }))
            toast.info('Your session is still being generated. Try again in a moment.')
            return
          }
          setPlayer((prev) => ({ ...prev, isLoading: false, isPlaying: false }))
          toast.error('Could not load session audio.')
          console.error('Audio load failed:', err)
        }
      })()
    },
    [],
  )

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlayer((prev) => ({ ...prev, isPlaying: false }))
  }, [])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !audio.src) return
    // Only flip `isPlaying` to true once the browser has actually started
    // playback. Autoplay policies, not-ready media, or a rejected play()
    // promise would otherwise leave the UI showing "playing" while the
    // `<audio>` element is still paused.
    void audio
      .play()
      .then(() => {
        setPlayer((prev) => ({ ...prev, isPlaying: true }))
      })
      .catch(() => {
        setPlayer((prev) => ({ ...prev, isPlaying: false }))
      })
  }, [])

  const recordCompletion = useCallback((snapshot: AudioPlayerState) => {
    if (!snapshot.sessionId) return
    if (recordedSessionIdRef.current === snapshot.sessionId) return
    recordedSessionIdRef.current = snapshot.sessionId
    void recordSessionPlay(snapshot.sessionId).catch((err) => {
      // Non-fatal — analytics, not user-visible state.
      console.warn('Failed to record session play:', err)
    })
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setPlayer((prev) => {
      recordCompletion(prev)
      setCompletedSession({ title: prev.sessionTitle, duration: prev.duration })
      setShowFeedback(true)
      return INITIAL_STATE
    })
  }, [recordCompletion])

  const setProgress = useCallback((progress: number | ((prev: number) => number)) => {
    setPlayer((prev) => {
      const next = typeof progress === 'function' ? progress(prev.progress) : progress
      const audio = audioRef.current
      if (audio && Number.isFinite(next) && Math.abs((audio.currentTime || 0) - next) > 1) {
        try {
          audio.currentTime = next
        } catch {
          /* ignore seek errors on unready media */
        }
      }
      return { ...prev, progress: next }
    })
  }, [])

  const togglePlayPause = useCallback(() => {
    setPlayer((prev) => {
      const audio = audioRef.current
      if (audio && audio.src) {
        if (prev.isPlaying) {
          audio.pause()
        } else {
          void audio.play().catch(() => { /* ignore */ })
        }
      }
      return { ...prev, isPlaying: !prev.isPlaying }
    })
  }, [])

  const seekBackward = useCallback(() => {
    setProgress((p) => Math.max(0, p - 15))
  }, [setProgress])

  const seekForward = useCallback(() => {
    setProgress((p) => Math.min(player.duration, p + 15))
  }, [player.duration, setProgress])

  // Wire real audio-element events so `progress` / `duration` track
  // the actual media rather than a fake ticker.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTime = () => {
      setPlayer((prev) => ({ ...prev, progress: audio.currentTime }))
    }
    const handleMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setPlayer((prev) => ({ ...prev, duration: audio.duration }))
      }
    }
    const handlePlaying = () => {
      setPlayer((prev) => ({ ...prev, isPlaying: true }))
    }
    const handlePaused = () => {
      setPlayer((prev) => ({ ...prev, isPlaying: false }))
    }
    const handleEnded = () => {
      setPlayer((prev) => {
        recordCompletion(prev)
        setCompletedSession({ title: prev.sessionTitle, duration: prev.duration })
        setShowFeedback(true)
        return INITIAL_STATE
      })
    }
    const handleError = () => {
      toast.error('Audio playback failed.')
      setPlayer((prev) => ({ ...prev, isPlaying: false, isLoading: false }))
    }

    audio.addEventListener('timeupdate', handleTime)
    audio.addEventListener('loadedmetadata', handleMeta)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePaused)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    return () => {
      audio.removeEventListener('timeupdate', handleTime)
      audio.removeEventListener('loadedmetadata', handleMeta)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePaused)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [recordCompletion])

  useMediaSession(
    {
      title: player.sessionTitle,
      artist: 'HypnoSleep',
      album: player.category,
      duration: player.duration,
      position: player.progress,
      playbackState: player.isPlaying ? 'playing' : 'paused',
    },
    {
      onPlay: resume,
      onPause: pause,
      onSeekBackward: seekBackward,
      onSeekForward: seekForward,
      onStop: stop,
    },
    player.isActive,
  )

  // Fallback "fake" ticker for sessions without a real audio source
  // (templates, previews). Kept so the existing UI for those flows
  // doesn't look frozen.
  useEffect(() => {
    if (!player.isPlaying || !player.isActive) return
    if (player.sessionId) return

    const interval = setInterval(() => {
      setPlayer((prev) => {
        if (prev.progress >= prev.duration) {
          setCompletedSession({ title: prev.sessionTitle, duration: prev.duration })
          setShowFeedback(true)
          return { ...prev, isPlaying: false }
        }
        return { ...prev, progress: prev.progress + 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [player.isPlaying, player.isActive, player.sessionId])

  const value = useMemo<AudioPlayerContextType>(
    () => ({
      player,
      play,
      pause,
      resume,
      stop,
      setProgress,
      togglePlayPause,
      showFeedback,
      setShowFeedback,
      completedSession,
    }),
    [player, play, pause, resume, stop, setProgress, togglePlayPause, showFeedback, completedSession],
  )

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext)
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}
