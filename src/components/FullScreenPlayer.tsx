import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, CaretDown, DotsThree, ArrowCounterClockwise, ArrowClockwise, Clock, Waves, Repeat, TrendDown, Speedometer, Check, Stop, Heart, ShareNetwork, Flag } from '@phosphor-icons/react'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from './ui/dropdown-menu'
import { toast } from 'sonner'
import { SleepTimerModal } from './SleepTimerModal'
import { SoundsModal } from './SoundsModal'
import { useKV } from '@/hooks/use-kv'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { toggleSessionFavorite, reportSession } from '@/lib/api-endpoints'
import { ReportSessionModal } from './ReportSessionModal'

interface FullScreenPlayerProps {
  isOpen: boolean
  isPlaying: boolean
  sessionTitle: string
  category: string
  progress: number
  duration: number
  onClose: () => void
  onPlayPause: () => void
  onSeek: (newProgress: number) => void
  onStop?: () => void
}

export function FullScreenPlayer({
  isOpen,
  isPlaying,
  sessionTitle,
  category,
  progress,
  duration,
  onClose,
  onPlayPause,
  onSeek,
  onStop,
}: FullScreenPlayerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [localProgress, setLocalProgress] = useState(progress)
  const [showTimerModal, setShowTimerModal] = useState(false)
  const [showSoundsModal, setShowSoundsModal] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState<number | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  
  const [loopEnabled, setLoopEnabled] = useKV<boolean>('player-loop-enabled', false)
  const [fadeOutEnabled, setFadeOutEnabled] = useKV<boolean>('player-fadeout-enabled', false)
  const [playbackSpeed, setPlaybackSpeed] = useKV<number>('player-playback-speed', 1)
  const [showReport, setShowReport] = useState(false)
  const [favoritePending, setFavoritePending] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const { player, setLoop, setPlaybackRate, setFadeOut } = useAudioPlayer()
  const sessionId = player.sessionId

  // Push the persisted control values into the audio context whenever
  // they change so a fresh playback (or a toggle while playing) takes
  // effect immediately.
  useEffect(() => {
    setLoop(loopEnabled ?? false)
  }, [loopEnabled, setLoop])

  useEffect(() => {
    setFadeOut(fadeOutEnabled ?? false)
  }, [fadeOutEnabled, setFadeOut])

  useEffect(() => {
    setPlaybackRate(playbackSpeed ?? 1)
  }, [playbackSpeed, setPlaybackRate])

  // Reset the local favorite flag whenever the active session changes so
  // we don't carry over a previous toggle across sessions.
  useEffect(() => {
    setFavorited(false)
  }, [sessionId])


  useEffect(() => {
    if (!isDragging) {
      setLocalProgress(progress)
    }
  }, [progress, isDragging])

  useEffect(() => {
    if (timerMinutes === null || remainingSeconds === null) return

    if (timerMinutes === -1) {
      const remaining = duration - (localProgress / 100) * duration
      setRemainingSeconds(Math.floor(remaining))
    }

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) {
          toast.info('Sleep timer ended')
          onPlayPause()
          setTimerMinutes(null)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerMinutes, remainingSeconds, duration, localProgress, onPlayPause])

  useEffect(() => {
    if (timerMinutes === -1) {
      const remaining = duration - (localProgress / 100) * duration
      setRemainingSeconds(Math.floor(remaining))
    }
  }, [localProgress, duration, timerMinutes])

  const [chromeOpacity, setChromeOpacity] = useState(1)
  const dimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wakeChrome = useCallback(() => {
    setChromeOpacity(1)
    if (dimTimerRef.current) {
      clearTimeout(dimTimerRef.current)
    }
    dimTimerRef.current = setTimeout(() => {
      setChromeOpacity(0.1)
    }, 3000)
  }, [])

  // Initialize: when the player opens, start at full opacity then dim
  // after 3s. When it closes, clear the timer.
  useEffect(() => {
    if (!isOpen) {
      if (dimTimerRef.current) clearTimeout(dimTimerRef.current)
      setChromeOpacity(1)
      return
    }
    wakeChrome()
    return () => {
      if (dimTimerRef.current) clearTimeout(dimTimerRef.current)
    }
  }, [isOpen, wakeChrome])

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value)
    setLocalProgress(newProgress)
  }

  const handleSeekEnd = () => {
    setIsDragging(false)
    onSeek(localProgress)
  }

  const handleRewind = () => {
    const newProgress = Math.max(0, localProgress - (15 / duration) * 100)
    setLocalProgress(newProgress)
    onSeek(newProgress)
  }

  const handleForward = () => {
    const newProgress = Math.min(100, localProgress + (15 / duration) * 100)
    setLocalProgress(newProgress)
    onSeek(newProgress)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const elapsedSeconds = (localProgress / 100) * duration
  const remainingPlaybackSeconds = duration - elapsedSeconds

  const handleSetTimer = (minutes: number) => {
    setTimerMinutes(minutes)
    if (minutes === -1) {
      const remaining = duration - (localProgress / 100) * duration
      setRemainingSeconds(Math.floor(remaining))
    } else {
      setRemainingSeconds(minutes * 60)
    }
  }

  const handleCancelTimer = () => {
    setTimerMinutes(null)
    setRemainingSeconds(null)
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    if (mins < 1) return `${seconds}s`
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h${remainingMins > 0 ? ` ${remainingMins}m` : ''}`
  }

  const handleToggleLoop = () => {
    setLoopEnabled((current) => !current)
  }

  const handleToggleFadeOut = () => {
    setFadeOutEnabled((current) => !current)
  }

  const handleSetPlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-[var(--ls-bg)]"
        >
          <BreathingBackground />

          <motion.div
            className="ls-player relative z-10 h-full flex flex-col"
            animate={{ opacity: chromeOpacity }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onPointerMove={wakeChrome}
            onPointerDown={wakeChrome}
            onTouchStart={wakeChrome}
            onKeyDown={wakeChrome}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                aria-label="close player"
              >
                <CaretDown weight="regular" className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowSoundsModal(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                  aria-label="background sound"
                >
                  <Waves weight="regular" className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowTimerModal(true)}
                  className="relative w-10 h-10 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                  aria-label="sleep timer"
                >
                  <Clock weight="regular" className="w-5 h-5" />
                  {timerMinutes !== null && remainingSeconds !== null && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[var(--ls-sand)] text-[var(--ls-bg)] text-[10px] font-medium">
                      {formatCountdown(remainingSeconds)}
                    </span>
                  )}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                      aria-label="more options"
                    >
                      <DotsThree weight="regular" className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-[var(--ls-bg-elevated)] border-[var(--ls-border-strong)] text-[var(--ls-text)]"
                  >
                    <DropdownMenuItem onClick={handleToggleLoop} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat weight="regular" className="w-4 h-4" />
                        <span>Loop Session</span>
                      </div>
                      {loopEnabled && <Check weight="regular" className="w-4 h-4 text-[var(--ls-sand)]" />}
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleToggleFadeOut} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendDown weight="regular" className="w-4 h-4" />
                        <span>Fade Out</span>
                      </div>
                      {fadeOutEnabled && <Check weight="regular" className="w-4 h-4 text-[var(--ls-sand)]" />}
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div className="flex items-center gap-2">
                          <Speedometer weight="regular" className="w-4 h-4" />
                          <span>Playback Speed</span>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="bg-[var(--ls-bg-elevated)] border-[var(--ls-border-strong)] text-[var(--ls-text)]">
                        <DropdownMenuItem
                          onClick={() => handleSetPlaybackSpeed(0.75)}
                          className="flex items-center justify-between"
                        >
                          <span>0.75x</span>
                          {playbackSpeed === 0.75 && <Check weight="regular" className="w-4 h-4 text-[var(--ls-sand)]" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSetPlaybackSpeed(1)}
                          className="flex items-center justify-between"
                        >
                          <span>1x (Normal)</span>
                          {playbackSpeed === 1 && <Check weight="regular" className="w-4 h-4 text-[var(--ls-sand)]" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSetPlaybackSpeed(1.25)}
                          className="flex items-center justify-between"
                        >
                          <span>1.25x</span>
                          {playbackSpeed === 1.25 && <Check weight="regular" className="w-4 h-4 text-[var(--ls-sand)]" />}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => {
                        if (onStop) {
                          onStop()
                          onClose()
                        }
                      }}
                      className="text-[var(--ls-text)]"
                    >
                      <div className="flex items-center gap-2">
                        <Stop weight="regular" className="w-4 h-4" />
                        <span>Stop Session</span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={async () => {
                        const url = sessionId
                          ? `${window.location.origin}/?session=${encodeURIComponent(sessionId)}`
                          : window.location.origin
                        const shareData = { title: sessionTitle, text: `Listen to "${sessionTitle}" on HypnoSleep`, url }
                        try {
                          if (typeof navigator !== 'undefined' && 'share' in navigator) {
                            await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share(shareData)
                            return
                          }
                          await (navigator as Navigator).clipboard.writeText(url)
                          toast.success('Link copied to clipboard')
                        } catch {
                          // User cancelled the share sheet — silent.
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <ShareNetwork weight="regular" className="w-4 h-4" />
                        <span>Share</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!sessionId || favoritePending}
                      onClick={async () => {
                        if (!sessionId) {
                          toast.info('Generate this session first to favorite it.')
                          return
                        }
                        setFavoritePending(true)
                        try {
                          const { favorited: now } = await toggleSessionFavorite(sessionId)
                          setFavorited(now)
                          toast.success(now ? 'Added to favorites' : 'Removed from favorites')
                        } catch {
                          toast.error('Could not update favorite.')
                        } finally {
                          setFavoritePending(false)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Heart
                          weight={favorited ? 'fill' : 'regular'}
                          className={`w-4 h-4 ${favorited ? 'text-[var(--ls-sand)]' : ''}`}
                        />
                        <span>{favorited ? 'Unfavorite' : 'Favorite'}</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowReport(true)}
                      disabled={!sessionId}
                    >
                      <div className="flex items-center gap-2">
                        <Flag weight="regular" className="w-4 h-4" />
                        <span>Report</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <h1 className="font-fraunces italic lowercase text-3xl text-[var(--ls-text)] text-center leading-tight max-w-md">
                {sessionTitle.toLowerCase()}
              </h1>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                  {category}
                </span>
                {fadeOutEnabled && (
                  <>
                    <span className="text-[var(--ls-text-subtle)]">·</span>
                    <span className="text-xs lowercase text-[var(--ls-sand-dim)]">
                      fade
                    </span>
                  </>
                )}
                {favorited && (
                  <>
                    <span className="text-[var(--ls-text-subtle)]">·</span>
                    <Heart
                      weight="fill"
                      className="w-3.5 h-3.5 text-[var(--ls-sand)]"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="px-8 pb-8 flex flex-col items-center gap-6">
              <div className="flex items-center justify-center gap-10">
                <button
                  type="button"
                  onClick={handleRewind}
                  className="w-12 h-12 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                  aria-label="rewind 15 seconds"
                >
                  <ArrowCounterClockwise weight="regular" className="w-6 h-6" />
                </button>

                <div className="relative w-24 h-24">
                  <ProgressRing progress={localProgress} />
                  <button
                    type="button"
                    onClick={onPlayPause}
                    className="absolute inset-2 flex items-center justify-center rounded-full border border-[var(--ls-sand)] bg-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/8 transition-colors"
                    aria-label={isPlaying ? 'pause' : 'play'}
                  >
                    {isPlaying ? (
                      <Pause weight="regular" className="w-8 h-8 text-[var(--ls-sand)]" />
                    ) : (
                      <Play weight="regular" className="w-8 h-8 text-[var(--ls-sand)] ml-0.5" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleForward}
                  className="w-12 h-12 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                  aria-label="forward 15 seconds"
                >
                  <ArrowClockwise weight="regular" className="w-6 h-6" />
                </button>
              </div>

              <div className="w-full max-w-md space-y-2">
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={localProgress}
                    onChange={handleSeek}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={handleSeekEnd}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={handleSeekEnd}
                    className="w-full h-[2px] bg-[var(--ls-border-strong)] rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-[var(--ls-sand)]
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-[var(--ls-sand)]
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--ls-sand) 0%, var(--ls-sand) ${localProgress}%, var(--ls-border-strong) ${localProgress}%, var(--ls-border-strong) 100%)`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--ls-text-subtle)] font-mono tabular-nums">
                  <span>{formatTime(elapsedSeconds)}</span>
                  <span>-{formatTime(remainingPlaybackSeconds)}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <SleepTimerModal
            isOpen={showTimerModal}
            onClose={() => setShowTimerModal(false)}
            onSetTimer={handleSetTimer}
            onCancelTimer={handleCancelTimer}
            activeTimer={timerMinutes}
            remainingSeconds={remainingSeconds}
          />

          <SoundsModal
            isOpen={showSoundsModal}
            onClose={() => setShowSoundsModal(false)}
          />

          <ReportSessionModal
            isOpen={showReport}
            onClose={() => setShowReport(false)}
            onSubmit={async (reason, details) => {
              if (!sessionId) return
              try {
                await reportSession(sessionId, reason, details)
                toast.success('Thanks — our team will review this report.')
                setShowReport(false)
              } catch {
                toast.error('Could not submit report.')
              }
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BreathingBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'var(--ls-bg)' }}
      aria-hidden="true"
    >
      {/* A single soft radial that pulses 4s in / 4s out.
          No rotation, no color cycling, no blobs. */}
      <motion.div
        className="absolute"
        style={{
          width: '90vmin',
          height: '90vmin',
          left: '50%',
          top: '50%',
          translateX: '-50%',
          translateY: '-50%',
          background:
            'radial-gradient(circle, rgba(201, 182, 163, 0.08) 0%, rgba(201, 182, 163, 0.03) 35%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Subtle grain to avoid banding on dark backgrounds — same
          texture used on HomePage. Static, no animation. */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.4'/></svg>\")",
        }}
      />
    </div>
  )
}

function ProgressRing({ progress }: { progress: number }) {
  // SVG ring inscribed in a 96×96 box (the play button parent is w-24
  // h-24 = 96px). Stroke 1.5px, sand. Track is hairline border.
  const size = 96
  const strokeWidth = 1.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--ls-border-strong)"
        strokeWidth={strokeWidth}
      />
      {/* Progress — starts at top (12 o'clock), grows clockwise */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--ls-sand)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 200ms linear' }}
      />
    </svg>
  )
}
