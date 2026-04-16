import { useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'

interface MediaSessionConfig {
  title: string
  artist?: string
  album?: string
  artwork?: { src: string; sizes: string; type: string }[]
  duration?: number
  position?: number
  playbackState?: 'none' | 'paused' | 'playing'
}

interface MediaSessionHandlers {
  onPlay?: () => void
  onPause?: () => void
  onSeekBackward?: () => void
  onSeekForward?: () => void
  onStop?: () => void
}

export function useMediaSession(
  config: MediaSessionConfig,
  handlers: MediaSessionHandlers,
  isActive: boolean
) {
  const [hasShownBackgroundToast, setHasShownBackgroundToast] = useKV<boolean>(
    'has-shown-background-playback-toast',
    false
  )

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    if (!isActive) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }

    if (!hasShownBackgroundToast) {
      toast.success('Background playback enabled', {
        description: 'Audio will continue playing when app is backgrounded',
        duration: 4000,
      })
      setHasShownBackgroundToast(true)
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: config.title,
      artist: config.artist || 'HypnoSleep',
      album: config.album || 'Session',
      artwork: config.artwork || [
        {
          src: '/hypnosleep-icon-96.png',
          sizes: '96x96',
          type: 'image/png',
        },
        {
          src: '/hypnosleep-icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/hypnosleep-icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    })

    navigator.mediaSession.playbackState = config.playbackState || 'playing'

    if (config.duration !== undefined) {
      navigator.mediaSession.setPositionState({
        duration: config.duration,
        position: config.position || 0,
        playbackRate: 1.0,
      })
    }
  }, [
    config.title,
    config.artist,
    config.album,
    config.duration,
    config.position,
    config.playbackState,
    isActive,
    hasShownBackgroundToast,
    setHasShownBackgroundToast,
  ])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !isActive) {
      return
    }

    const actionHandlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = []

    if (handlers.onPlay) {
      const handler: MediaSessionActionHandler = () => {
        handlers.onPlay?.()
      }
      navigator.mediaSession.setActionHandler('play', handler)
      actionHandlers.push(['play', handler])
    }

    if (handlers.onPause) {
      const handler: MediaSessionActionHandler = () => {
        handlers.onPause?.()
      }
      navigator.mediaSession.setActionHandler('pause', handler)
      actionHandlers.push(['pause', handler])
    }

    if (handlers.onSeekBackward) {
      const handler: MediaSessionActionHandler = () => {
        handlers.onSeekBackward?.()
      }
      navigator.mediaSession.setActionHandler('seekbackward', handler)
      actionHandlers.push(['seekbackward', handler])
    }

    if (handlers.onSeekForward) {
      const handler: MediaSessionActionHandler = () => {
        handlers.onSeekForward?.()
      }
      navigator.mediaSession.setActionHandler('seekforward', handler)
      actionHandlers.push(['seekforward', handler])
    }

    if (handlers.onStop) {
      const handler: MediaSessionActionHandler = () => {
        handlers.onStop?.()
      }
      navigator.mediaSession.setActionHandler('stop', handler)
      actionHandlers.push(['stop', handler])
    }

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch (error) {
          console.error(`Error removing action handler for ${action}:`, error)
        }
      })
    }
  }, [
    handlers.onPlay,
    handlers.onPause,
    handlers.onSeekBackward,
    handlers.onSeekForward,
    handlers.onStop,
    isActive,
  ])
}
