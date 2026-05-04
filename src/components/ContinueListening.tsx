import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X } from '@phosphor-icons/react'

interface ContinueListeningProps {
  sessionTitle: string
  category: string
  categoryColor: string
  progress: number
  durationRemaining: string
  onResume: () => void
  onDismiss: () => void
}

const STYLES = `
.ls-continue-listening {
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
.ls-continue-listening .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function ContinueListening({
  sessionTitle,
  category,
  progress,
  durationRemaining,
  onResume,
  onDismiss,
}: ContinueListeningProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)

    setTimeout(() => {
      onDismiss()
    }, 300)
  }

  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)))

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="ls-continue-listening relative"
        >
          <style>{STYLES}</style>

          <div className="relative overflow-hidden rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/70 text-[var(--ls-text)]">
            <div
              className="absolute left-0 top-0 h-full w-1 bg-[var(--ls-sand)]"
              aria-hidden="true"
            />

            <div className="p-5 pl-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 px-2.5 py-1 text-xs lowercase text-[var(--ls-sand)]">
                      {category.toLowerCase()}
                    </span>
                  </div>

                  <h3 className="font-fraunces truncate text-xl italic lowercase leading-snug text-[var(--ls-text)]">
                    {sessionTitle}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                  aria-label="dismiss"
                >
                  <X size={16} weight="regular" />
                </button>
              </div>

              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs lowercase text-[var(--ls-text-muted)]">
                  <span className="tabular-nums">{clampedProgress}% completed</span>
                  <span>{durationRemaining} remaining</span>
                </div>

                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ls-border-strong)]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={clampedProgress}
                  aria-valuetext={`${clampedProgress}% completed, ${durationRemaining} remaining`}
                  aria-label="listening progress"
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${clampedProgress}%` }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[var(--ls-sand)]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={onResume}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--ls-sand)] px-4 font-fraunces text-lg italic lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                <Play weight="fill" size={19} />
                resume session
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
