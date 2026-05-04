import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Clock, Moon } from '@phosphor-icons/react'
import { useState } from 'react'

interface SleepTimerModalProps {
  isOpen: boolean
  onClose: () => void
  onSetTimer: (minutes: number) => void
  onCancelTimer: () => void
  activeTimer: number | null
  remainingSeconds: number | null
}

const PRESET_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
]

const STYLES = `
.ls-sleep-timer {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  --ls-danger: #d79a8b;
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-sleep-timer .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function SleepTimerModal({
  isOpen,
  onClose,
  onSetTimer,
  onCancelTimer,
  activeTimer,
  remainingSeconds,
}: SleepTimerModalProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')

  const handlePresetClick = (minutes: number) => {
    onSetTimer(minutes)
    onClose()
  }

  const handleEndOfSession = () => {
    onSetTimer(-1)
    onClose()
  }

  const handleCustomSubmit = () => {
    const minutes = parseInt(customMinutes, 10)

    if (minutes > 0 && minutes <= 180) {
      onSetTimer(minutes)
      setCustomMinutes('')
      setShowCustomInput(false)
      onClose()
    }
  }

  const handleCancel = () => {
    onCancelTimer()
    onClose()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isEndOfSessionTimer = activeTimer === -1

  const progressPercentage =
    activeTimer && activeTimer > 0 && remainingSeconds !== null
      ? Math.max(
          0,
          Math.min(
            100,
            ((activeTimer * 60 - remainingSeconds) / (activeTimer * 60)) * 100,
          ),
        )
      : 0

  const circumference = 439.6
  const dashOffset = circumference - (circumference * progressPercentage) / 100
  const customMinutesNumber = parseInt(customMinutes, 10)
  const customIsValid = customMinutesNumber > 0 && customMinutesNumber <= 180

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-sleep-timer">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 310 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-md border-t border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text)]"
            role="dialog"
            aria-modal="true"
            aria-label="sleep timer"
          >
            <div className="mx-auto mb-5 mt-3 h-1.5 w-12 rounded-full bg-[var(--ls-border-strong)]" />

            <div className="max-h-[calc(85vh-2rem)] overflow-y-auto px-6 pb-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                    player
                  </p>
                  <h2 className="font-fraunces text-2xl italic lowercase text-[var(--ls-text)]">
                    sleep timer
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="close sleep timer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {activeTimer !== null && remainingSeconds !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="mb-8 flex flex-col items-center"
                >
                  <div className="relative mb-4 h-40 w-40">
                    <svg className="h-full w-full -rotate-90 transform">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-[var(--ls-border-strong)]"
                      />

                      {isEndOfSessionTimer ? (
                        <motion.circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          className="text-[var(--ls-sand)]"
                          strokeDasharray="90 439.6"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                          style={{ transformOrigin: '80px 80px' }}
                        />
                      ) : (
                        <motion.circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          className="text-[var(--ls-sand)]"
                          initial={{
                            strokeDasharray: `${circumference} ${circumference}`,
                            strokeDashoffset: circumference,
                          }}
                          animate={{ strokeDashoffset: dashOffset }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      )}
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="font-fraunces text-4xl italic lowercase text-[var(--ls-text)]">
                        {isEndOfSessionTimer ? 'end' : formatTime(remainingSeconds)}
                      </div>
                      <div className="mt-1 text-sm lowercase text-[var(--ls-text-muted)]">
                        {isEndOfSessionTimer ? 'of session' : 'remaining'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="h-11 w-full max-w-xs rounded-md border border-[var(--ls-danger)]/40 px-5 text-sm lowercase text-[var(--ls-danger)] transition-colors hover:bg-[var(--ls-danger)]/8 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-danger)]/50"
                  >
                    cancel timer
                  </button>
                </motion.div>
              )}

              {activeTimer === null && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {PRESET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePresetClick(option.value)}
                        className="h-16 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg)]/35 text-lg lowercase text-[var(--ls-text)] transition-all hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-sand)]/8 active:scale-[0.98] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleEndOfSession}
                    className="flex h-16 w-full items-center justify-center gap-2 rounded-md border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 text-lg lowercase text-[var(--ls-text)] transition-all hover:bg-[var(--ls-sand)]/12 active:scale-[0.98] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                  >
                    <Moon className="h-5 w-5 text-[var(--ls-sand)]" weight="regular" />
                    end of session
                  </button>

                  {!showCustomInput ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomInput(true)}
                      className="flex h-16 w-full items-center justify-center gap-2 rounded-md border border-[var(--ls-border-strong)] text-lg lowercase text-[var(--ls-text-muted)] transition-all hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] active:scale-[0.98] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                    >
                      <Clock className="h-5 w-5" weight="regular" />
                      custom
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg)]/35 p-4"
                    >
                      <label
                        htmlFor="custom-minutes"
                        className="block text-sm lowercase text-[var(--ls-text-muted)]"
                      >
                        enter minutes (1–180)
                      </label>

                      <div className="flex gap-2">
                        <input
                          id="custom-minutes"
                          type="number"
                          min="1"
                          max="180"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customIsValid) {
                              handleCustomSubmit()
                            }
                          }}
                          placeholder="e.g., 90"
                          className="h-11 min-w-0 flex-1 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg)] px-3 text-sm text-[var(--ls-text)] placeholder:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                        />

                        <button
                          type="button"
                          onClick={handleCustomSubmit}
                          disabled={!customIsValid}
                          aria-label="set custom sleep timer"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 disabled:cursor-not-allowed disabled:bg-[var(--ls-bg-elevated)] disabled:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomInput(false)
                          setCustomMinutes('')
                        }}
                        className="text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                      >
                        cancel
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
