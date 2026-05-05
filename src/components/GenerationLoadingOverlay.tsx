import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'
import { X, PenNib, Waveform, MusicNote, Sparkle, Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface GenerationStep {
  id: number
  label: string
  icon: ReactNode
  status: 'pending' | 'active' | 'complete'
}

interface GenerationLoadingOverlayProps {
  isOpen: boolean
  onCancel: () => void
  /**
   * Current backend step name as reported by the SSE stream. One of
   * `queued | script | tts | mix | upload | done | error`. When
   * omitted the overlay falls back to a simple indeterminate display.
   */
  step?: string
  /** 0–100 progress percent as reported by the backend. */
  percent?: number
  /** Optional human-readable status message from the backend. */
  message?: string
}

// Maps each canonical backend step to the user-facing row it belongs
// to. `upload` and `done` both drive the "finalizing session..." row
// (index 3). Unknown or error states keep the existing queued fallback.
const STEP_INDEX: Record<string, number> = {
  queued: 0,
  script: 0,
  tts: 1,
  mix: 2,
  upload: 3,
  done: 3,
}

const STYLES = `
.ls-generation-overlay {
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
.ls-generation-overlay .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function GenerationLoadingOverlay({
  isOpen,
  onCancel,
  step,
  percent,
  message,
}: GenerationLoadingOverlayProps) {
  const { t } = useTranslation()
  const baseSteps: Omit<GenerationStep, 'status'>[] = [
    { id: 1, label: t('generationLoading.writing'), icon: <PenNib weight="regular" /> },
    { id: 2, label: t('generationLoading.synthesizing'), icon: <Waveform weight="regular" /> },
    { id: 3, label: t('generationLoading.addingBackground'), icon: <MusicNote weight="regular" /> },
    { id: 4, label: t('generationLoading.finalizing'), icon: <Sparkle weight="regular" /> },
  ]

  const activeIdx = STEP_INDEX[step ?? 'queued'] ?? 0
  const allDone = step === 'done'
  const steps: GenerationStep[] = baseSteps.map((s, idx) => {
    let status: GenerationStep['status'] = 'pending'
    if (allDone || idx < activeIdx) status = 'complete'
    else if (idx === activeIdx) status = 'active'
    return { ...s, status }
  })

  // Round and clamp the backend percent so the progress bar stays
  // within a sane 0–100 range even if something upstream misbehaves.
  const clampedPercent = Math.max(
    0,
    Math.min(100, Math.round(percent ?? 0)),
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="ls-generation-overlay fixed inset-0 z-50 flex items-center justify-center bg-[var(--ls-bg)] text-[var(--ls-text)]"
        >
          <style>{STYLES}</style>

          <div className="w-full max-w-md px-6 py-10">
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              <div
                className="relative mb-10 flex h-40 w-40 items-center justify-center"
                aria-hidden="true"
              >
                {[0, 1, 2].map((index) => (
                  <motion.div
                    key={index}
                    className="absolute rounded-full border border-[var(--ls-sand)]/30"
                    initial={{ width: 56, height: 56, opacity: 0.35 }}
                    animate={{
                      width: [56, 148, 148],
                      height: [56, 148, 148],
                      opacity: [0.35, 0.12, 0],
                    }}
                    transition={{
                      duration: 3.4,
                      repeat: Infinity,
                      delay: index * 0.55,
                      ease: 'easeOut',
                    }}
                  />
                ))}

                <motion.div
                  animate={{ scale: [1, 1.04, 1], opacity: [0.86, 1, 0.86] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]"
                >
                  <Sparkle
                    size={34}
                    weight="regular"
                    className="text-[var(--ls-sand)]"
                  />
                </motion.div>
              </div>

              <h2 className="font-fraunces italic lowercase text-3xl leading-tight text-[var(--ls-text)]">
                building your session
              </h2>

              <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--ls-text-muted)]">
                keep this screen open while hypnosleep prepares the audio.
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.35, ease: 'easeOut' }}
              className="mt-10 space-y-2"
            >
              {steps.map((generationStep, index) => (
                <motion.div
                  key={generationStep.id}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.18 + index * 0.06, duration: 0.28 }}
                  className={`flex items-center gap-3 rounded-md border px-3.5 py-3 transition-colors duration-300 ${
                    generationStep.status === 'active'
                      ? 'border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8'
                      : 'border-[var(--ls-border)] bg-[var(--ls-bg-elevated)]/40'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                      generationStep.status === 'complete'
                        ? 'border-[var(--ls-sand)] text-[var(--ls-sand)]'
                        : generationStep.status === 'active'
                        ? 'border-[var(--ls-sand-dim)] text-[var(--ls-sand)]'
                        : 'border-[var(--ls-border)] text-[var(--ls-text-subtle)]'
                    }`}
                  >
                    {generationStep.status === 'complete' ? (
                      <motion.div
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
                        <Check size={18} weight="regular" />
                      </motion.div>
                    ) : generationStep.status === 'active' ? (
                      <motion.div
                        animate={{ opacity: [0.65, 1, 0.65] }}
                        transition={{
                          duration: 1.6,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      >
                        {generationStep.icon}
                      </motion.div>
                    ) : (
                      generationStep.icon
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-left text-sm transition-colors duration-300 ${
                        generationStep.status === 'complete'
                          ? 'text-[var(--ls-text-muted)] line-through decoration-[var(--ls-border-strong)]'
                          : generationStep.status === 'active'
                          ? 'text-[var(--ls-text)]'
                          : 'text-[var(--ls-text-subtle)]'
                      }`}
                    >
                      {generationStep.label}
                    </p>
                  </div>

                  {generationStep.status === 'active' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-end gap-1"
                      aria-hidden="true"
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={{ height: [4, 11, 4] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.16,
                            ease: 'easeInOut',
                          }}
                          className="w-1 rounded-full bg-[var(--ls-sand)]"
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.34, duration: 0.35 }}
              className="mt-7 space-y-2"
            >
              {/* Live progress bar driven by the backend SSE stream. */}
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={clampedPercent}
                aria-valuetext={`${clampedPercent}% — ${message ?? 'Preparing your session...'}`}
                aria-label="Session generation progress"
                className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ls-border-strong)]"
              >
                <motion.div
                  className="h-full rounded-full bg-[var(--ls-sand)]"
                  animate={{ width: `${clampedPercent}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-[var(--ls-text-muted)]">
                <span
                  className="truncate pr-2"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {message ?? 'Preparing your session...'}
                </span>

                <span className="shrink-0 tabular-nums text-[var(--ls-text)]">
                  {clampedPercent}%
                </span>
              </div>
            </motion.div>

            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.44, duration: 0.35 }}
              onClick={onCancel}
              className="mx-auto mt-8 flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--ls-border-strong)] px-5 text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
            >
              <X size={16} weight="regular" />
              <span>{t('generationLoading.ariaClose')}</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
