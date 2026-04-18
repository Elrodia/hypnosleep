import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'

interface MiniPlayerProps {
  isPlaying: boolean
  sessionTitle: string
  progress: number
  onPlayPause: () => void
  onExpand: () => void
}

export function MiniPlayer({ isPlaying, sessionTitle, progress, onPlayPause, onExpand }: MiniPlayerProps) {
  const [fadeOutEnabled] = useKV<boolean>('player-fadeout-enabled', false)

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-20 left-0 right-0 z-40 px-4"
    >
      <div
        onClick={onExpand}
        className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-lg overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-foreground truncate">
              {sessionTitle}
            </p>
            {fadeOutEnabled && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                className="flex-shrink-0 px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-400/30"
              >
                <span className="text-xs font-medium text-purple-300">fade</span>
              </motion.div>
            )}
          </div>

          <Equalizer isPlaying={isPlaying} />

          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayPause()
            }}
            className="relative flex-shrink-0"
          >
            <CircularProgress progress={progress} />
            <div className="absolute inset-0 flex items-center justify-center">
              {isPlaying ? (
                <Pause weight="fill" className="w-5 h-5 text-primary" />
              ) : (
                <Play weight="fill" className="w-5 h-5 text-primary" />
              )}
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function Equalizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center gap-1 h-6">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-primary rounded-full"
          animate={{
            height: isPlaying ? ['40%', '100%', '60%', '80%', '40%'] : '40%',
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

function CircularProgress({ progress }: { progress: number }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="text-border"
      />
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="text-primary transition-all duration-300"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
