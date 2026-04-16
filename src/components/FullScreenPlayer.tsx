import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, CaretDown, DotsThree, ArrowCounterClockwise, ArrowClockwise, Clock, Waves, Repeat, TrendDown, Speedometer, Check, Stop } from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from './ui/dropdown-menu'
import { toast } from 'sonner'
import { SleepTimerModal } from './SleepTimerModal'
import { SoundsModal } from './SoundsModal'
import { useKV } from '@github/spark/hooks'

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
    toast.info('Rewound 15 seconds')
  }

  const handleForward = () => {
    const newProgress = Math.min(100, localProgress + (15 / duration) * 100)
    setLocalProgress(newProgress)
    onSeek(newProgress)
    toast.info('Skipped 15 seconds')
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
      toast.success('Timer set to end of session')
    } else {
      setRemainingSeconds(minutes * 60)
      toast.success(`Timer set for ${minutes} minutes`)
    }
  }

  const handleCancelTimer = () => {
    setTimerMinutes(null)
    setRemainingSeconds(null)
    toast.info('Timer cancelled')
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
    setLoopEnabled((current) => {
      const newValue = !current
      toast.success(newValue ? 'Loop enabled' : 'Loop disabled')
      return newValue
    })
  }

  const handleToggleFadeOut = () => {
    setFadeOutEnabled((current) => {
      const newValue = !current
      toast.success(newValue ? 'Fade out enabled' : 'Fade out disabled')
      return newValue
    })
  }

  const handleSetPlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed)
    toast.success(`Playback speed set to ${speed}x`)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-background"
        >
          <MorphingGradientBackground />

          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
              >
                <CaretDown weight="bold" className="w-6 h-6 text-white" />
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSoundsModal(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
                >
                  <Waves weight="bold" className="w-6 h-6 text-white" />
                </button>

                <button
                  onClick={() => setShowTimerModal(true)}
                  className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
                >
                  <Clock weight="bold" className="w-6 h-6 text-white" />
                  {timerMinutes !== null && remainingSeconds !== null && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-lg"
                    >
                      {formatCountdown(remainingSeconds)}
                    </motion.div>
                  )}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform">
                      <DotsThree weight="bold" className="w-6 h-6 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={handleToggleLoop} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat weight="bold" className="w-4 h-4" />
                        <span>Loop Session</span>
                      </div>
                      {loopEnabled && <Check weight="bold" className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={handleToggleFadeOut} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendDown weight="bold" className="w-4 h-4" />
                        <span>Fade Out</span>
                      </div>
                      {fadeOutEnabled && <Check weight="bold" className="w-4 h-4 text-primary" />}
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <div className="flex items-center gap-2">
                          <Speedometer weight="bold" className="w-4 h-4" />
                          <span>Playback Speed</span>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem 
                          onClick={() => handleSetPlaybackSpeed(0.75)}
                          className="flex items-center justify-between"
                        >
                          <span>0.75x</span>
                          {playbackSpeed === 0.75 && <Check weight="bold" className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleSetPlaybackSpeed(1)}
                          className="flex items-center justify-between"
                        >
                          <span>1x (Normal)</span>
                          {playbackSpeed === 1 && <Check weight="bold" className="w-4 h-4 text-primary" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleSetPlaybackSpeed(1.25)}
                          className="flex items-center justify-between"
                        >
                          <span>1.25x</span>
                          {playbackSpeed === 1.25 && <Check weight="bold" className="w-4 h-4 text-primary" />}
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
                      className="text-destructive"
                    >
                      <div className="flex items-center gap-2">
                        <Stop weight="bold" className="w-4 h-4" />
                        <span>Stop Session</span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem onClick={() => toast.success('Shared!')}>
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.success('Added to favorites!')}>
                      Favorite
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info('Report submitted')}>
                      Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-semibold text-white text-center mb-4 leading-tight"
              >
                {sessionTitle}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2"
              >
                <div className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                  <span className="text-sm font-medium text-white/90">{category}</span>
                </div>
                {fadeOutEnabled && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                    className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/30 to-indigo-500/30 backdrop-blur-sm border border-purple-400/30"
                  >
                    <span className="text-xs font-medium text-purple-200">fade</span>
                  </motion.div>
                )}
              </motion.div>
            </div>

            <div className="px-8 pb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-8 mb-8"
              >
                <button
                  onClick={handleRewind}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
                >
                  <ArrowCounterClockwise weight="bold" className="w-7 h-7 text-white" />
                </button>

                <button
                  onClick={onPlayPause}
                  className="w-20 h-20 flex items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  {isPlaying ? (
                    <Pause weight="fill" className="w-10 h-10 text-white" />
                  ) : (
                    <Play weight="fill" className="w-10 h-10 text-white ml-1" />
                  )}
                </button>

                <button
                  onClick={handleForward}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm active:scale-95 transition-transform"
                >
                  <ArrowClockwise weight="bold" className="w-7 h-7 text-white" />
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
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
                    className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4
                      [&::-moz-range-thumb]:h-4
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:shadow-lg
                      [&::-moz-range-thumb]:cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(255 255 255 / 0.9) 0%, rgb(255 255 255 / 0.9) ${localProgress}%, rgb(255 255 255 / 0.2) ${localProgress}%, rgb(255 255 255 / 0.2) 100%)`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>{formatTime(elapsedSeconds)}</span>
                  <span>-{formatTime(remainingPlaybackSeconds)}</span>
                </div>
              </motion.div>
            </div>
          </div>

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
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MorphingGradientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(circle at 20% 50%, #5b21b6 0%, #312e81 25%, #1e1b4b 50%, #0f172a 100%)',
            'radial-gradient(circle at 80% 30%, #6d28d9 0%, #4c1d95 25%, #1e1b4b 50%, #0f172a 100%)',
            'radial-gradient(circle at 50% 80%, #4c1d95 0%, #312e81 25%, #1e3a8a 50%, #0f172a 100%)',
            'radial-gradient(circle at 30% 20%, #5b21b6 0%, #3730a3 25%, #1e3a8a 50%, #0f172a 100%)',
            'radial-gradient(circle at 70% 70%, #6d28d9 0%, #312e81 25%, #1e1b4b 50%, #0f172a 100%)',
            'radial-gradient(circle at 20% 50%, #5b21b6 0%, #312e81 25%, #1e1b4b 50%, #0f172a 100%)',
          ],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full blur-3xl opacity-40"
        animate={{
          x: ['0%', '50%', '0%', '-30%', '0%'],
          y: ['0%', '30%', '60%', '20%', '0%'],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
          top: '-20%',
          left: '-20%',
        }}
      />

      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-30"
        animate={{
          x: ['0%', '-40%', '20%', '10%', '0%'],
          y: ['0%', '40%', '10%', '-20%', '0%'],
          scale: [1, 0.9, 1.3, 1, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        style={{
          background: 'radial-gradient(circle, #4338ca 0%, transparent 70%)',
          bottom: '-15%',
          right: '-15%',
        }}
      />

      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full blur-3xl opacity-25"
        animate={{
          x: ['0%', '30%', '-20%', '40%', '0%'],
          y: ['0%', '-30%', '40%', '10%', '0%'],
          scale: [1, 1.1, 1, 1.2, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        style={{
          background: 'radial-gradient(circle, #1e40af 0%, transparent 70%)',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/20" />
    </div>
  )
}
