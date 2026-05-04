import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, WarningCircle, CheckCircle } from '@phosphor-icons/react'

export type ReportReason = 'inappropriate' | 'inaccurate' | 'unsafe' | 'low_quality' | 'other'

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'inappropriate content' },
  { id: 'inaccurate', label: 'inaccurate or misleading' },
  { id: 'unsafe', label: 'unsafe / harmful' },
  { id: 'low_quality', label: 'low audio / script quality' },
  { id: 'other', label: 'other' },
]

interface ReportSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason, details: string) => Promise<void> | void
}

const STYLES = `
.ls-report-modal {
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
.ls-report-modal .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

/**
 * Lightweight modal for the FullScreenPlayer "report" entry. It collects
 * a categorical reason plus optional free-text details and hands them to
 * the parent, which POSTs to `/api/sessions/:id/report`.
 */
export function ReportSessionModal({ isOpen, onClose, onSubmit }: ReportSessionModalProps) {
  const [reason, setReason] = useState<ReportReason>('inappropriate')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, isOpen, onClose])

  const handleSubmit = async () => {
    setBusy(true)

    try {
      await onSubmit(reason, details.trim())
      setDetails('')
      setReason('inappropriate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-report-modal">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
            onClick={() => {
              if (!busy) onClose()
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.985 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-session-title"
            aria-describedby="report-session-description"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] p-5 text-[var(--ls-text)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                  player
                </p>

                <h2
                  id="report-session-title"
                  className="font-fraunces text-2xl italic lowercase text-[var(--ls-text)]"
                >
                  report this session
                </h2>

                <p
                  id="report-session-description"
                  className="mt-2 text-sm leading-relaxed text-[var(--ls-text-muted)]"
                >
                  help us improve. reports are reviewed by our team within 24 hours.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="close report modal"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                <X className="h-4 w-4" weight="regular" />
              </button>
            </div>

            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="sr-only">report reason</legend>

                {REASONS.map((item) => {
                  const selected = reason === item.id

                  return (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors ${
                        selected
                          ? 'border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8'
                          : 'border-[var(--ls-border)] hover:border-[var(--ls-border-strong)] hover:bg-[var(--ls-bg)]/45'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={item.id}
                        checked={selected}
                        disabled={busy}
                        onChange={() => setReason(item.id)}
                        className="h-4 w-4 accent-[var(--ls-sand)] disabled:cursor-not-allowed"
                      />

                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 text-sm lowercase text-[var(--ls-text)]">
                        {item.label}

                        {selected && (
                          <CheckCircle
                            weight="regular"
                            className="h-4 w-4 shrink-0 text-[var(--ls-sand)]"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </label>
                  )
                })}
              </fieldset>

              <div className="space-y-2">
                <label
                  htmlFor="report-details"
                  className="block text-xs lowercase text-[var(--ls-text-muted)]"
                >
                  additional details optional
                </label>

                <textarea
                  id="report-details"
                  value={details}
                  disabled={busy}
                  onChange={(event) => setDetails(event.target.value.slice(0, 500))}
                  placeholder="what happened?"
                  className="min-h-[96px] w-full resize-none rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ls-text)] placeholder:text-[var(--ls-text-subtle)] disabled:cursor-not-allowed disabled:opacity-55 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                />

                <div className="text-right text-[10px] tabular-nums text-[var(--ls-text-subtle)]">
                  {details.length}/500
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg)]/35 p-3">
                <WarningCircle
                  weight="regular"
                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ls-sand-dim)]"
                />
                <p className="text-xs leading-relaxed text-[var(--ls-text-muted)]">
                  reports help identify unsafe, inaccurate, or low-quality sessions.
                  this does not delete the session from your library.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="h-11 rounded-md border border-[var(--ls-border-strong)] px-5 text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)] sm:min-w-24"
              >
                cancel
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className="h-11 rounded-md bg-[var(--ls-sand)] px-5 text-sm lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 disabled:cursor-not-allowed disabled:bg-[var(--ls-bg)] disabled:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)] sm:min-w-32"
              >
                {busy ? 'submitting…' : 'submit report'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
