import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useMediaSession } from '@/hooks/use-media-session'

interface AudioPlayerState {
  isActive: boolean
  isPlaying: boolean
  sessionTitle: string
  category: string
  progress: number
  duration: number
}

interface AudioPlayerContextType {
  player: AudioPlayerState
  play: (title: string, category?: string, duration?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
  setProgress: (progress: number | ((prev: number) => number)) => void
  togglePlayPause: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined)

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<AudioPlayerState>({
    isActive: false,
    isPlaying: false,
    sessionTitle: '',
    category: '',
    progress: 0,
    duration: 0,
  })

  const play = (title: string, category = 'Session', duration = 600) => {
    setPlayer({
      isActive: true,
      isPlaying: true,
      sessionTitle: title,
      category,
      progress: 0,
      duration,
    })
  }

  const pause = () => {
    setPlayer((prev) => ({ ...prev, isPlaying: false }))
  }

  const resume = () => {
    setPlayer((prev) => ({ ...prev, isPlaying: true }))
  }

  const stop = () => {
    setPlayer({
      isActive: false,
      isPlaying: false,
      sessionTitle: '',
      category: '',
      progress: 0,
      duration: 0,
    })
  }

  const setProgress = (progress: number | ((prev: number) => number)) => {
    setPlayer((prev) => ({
      ...prev,
      progress: typeof progress === 'function' ? progress(prev.progress) : progress,
    }))
  }

  const togglePlayPause = () => {
    setPlayer((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
  }

  const seekBackward = () => {
    setPlayer((prev) => ({
      ...prev,
      progress: Math.max(0, prev.progress - 15),
    }))
  }

  const seekForward = () => {
    setPlayer((prev) => ({
      ...prev,
      progress: Math.min(prev.duration, prev.progress + 15),
    }))
  }

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
    player.isActive
  )

  useEffect(() => {
    if (!player.isPlaying || !player.isActive) return

    const interval = setInterval(() => {
      setPlayer((prev) => {
        if (prev.progress >= prev.duration) {
          return { ...prev, isPlaying: false }
        }
        return { ...prev, progress: prev.progress + 1 }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [player.isPlaying, player.isActive])

  return (
    <AudioPlayerContext.Provider
      value={{ player, play, pause, resume, stop, setProgress, togglePlayPause }}
    >
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
