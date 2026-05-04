import { motion } from 'framer-motion'
import { Play, Pause } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'

interface MiniPlayerProps {
  isPlaying: boolean
  sessionTitle: string
  progress: number
  onPlayPause: () => void
  onExpand: () => void
}

const STYLES = `
.ls-mini-player {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-mini-player .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function MiniPlayer({
  isPlaying,
  sessionTitle,
  progress,
  onPlayPause,
  onExpand,
}: MiniPlayerProps) {
  const [fadeOutEnabled] = useKV<boolean>('player-fadeout-enabled', false)
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)))

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="ls-mini-player fixed bottom-20 left-0 right-0 z-40 px-4"
    >
      <style>{STYLES}</style>

      <div
        role="button"
        tabIndex={0}
        onClick={onExpand}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onExpand()
          }
        }}
        className="cursor-pointer overflow-hidden rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/88 text-[var(--ls-text)] transition-colors hover:border-[var(--ls-sand-dim)] active:scale-[0.99] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
        aria-label={`open player for ${sessionTitle}`}
      >
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex flex-1 items-center gap-2">
            <p className="font-fraunces truncate text-base italic lowercase leading-tight text-[var(--ls-text)]">
              {sessionTitle}
            </p>

            {fadeOutEnabled && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                className="shrink-0 rounded-full border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 px-2 py-0.5"
              >
                <span className="text-[10px] lowercase text-[var(--ls-sand)]">
                  fade
                </span>
              </motion.div>
            )}
          </div>

          <Equalizer isPlaying={isPlaying} />

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onPlayPause()
            }}
            className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
            aria-label={isPlaying ? 'pause session' : 'play session'}
            aria-pressed={isPlaying}
          >
            <CircularProgress progress={clampedProgress} />

            <div className="absolute inset-0 flex items-center justify-center text-[var(--ls-sand)]">
              {isPlaying ? (
                <Pause weight="regular" className="h-5 w-5" />
              ) : (
                <Play weight="regular" className="ml-0.5 h-5 w-5" />
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
    <div className="flex h-6 items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-1 rounded-full bg-[var(--ls-sand)]"
          animate={{
            height: isPlaying ? ['40%', '100%', '60%', '80%', '40%'] : '40%',
            opacity: isPlaying ? [0.45, 1, 0.65, 0.8, 0.45] : 0.4,
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.15,
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
    <svg
      className="h-12 w-12 -rotate-90"
      viewBox="0 0 40 40"
      role="img"
      aria-label={`${progress}% complete`}
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="var(--ls-border-strong)"
        strokeWidth="2"
        fill="none"
      />

      <circle
        cx="20"
        cy="20"
        r="18"
        stroke="var(--ls-sand)"
        strokeWidth="2"
        fill="none"
        className="transition-all duration-300"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
