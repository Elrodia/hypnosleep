import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from '@phosphor-icons/react'
import { PRICING } from '@/config/pricing'

/**
 * `triggerReason` accepts both the legacy identifiers used by
 * existing callers (`'session-limit'`, `'premium-voice'`) and the
 * extended set (`'free_limit'`, `'pro_voice'`, `'pro_background'`,
 * `'pro_duration'`) so the modal can surface honest, scoped copy
 * for whichever gate triggered it.
 */
export type PaywallTriggerReason =
  | 'session-limit'
  | 'premium-voice'
  | 'free_limit'
  | 'pro_voice'
  | 'pro_background'
  | 'pro_duration'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: () => void
  triggerReason: PaywallTriggerReason
}

const TRIGGER_COPY: Record<PaywallTriggerReason, string> = {
  'session-limit': "you've used your free sessions for this month.",
  free_limit: "you've used your free sessions for this month.",
  'premium-voice': 'this voice is part of pro.',
  pro_voice: 'this voice is part of pro.',
  pro_background: 'this background is part of pro.',
  pro_duration: 'longer sessions are part of pro.',
}

const FREE_LINES = ['2 sessions, ever', '5 minutes each', '1 voice, 2 backgrounds']

const PRO_LINES = [
  '8 sessions per month',
  '3 to 12 minutes',
  'all 6 voices, all backgrounds',
  'priority generation',
]

const STYLES = `
.ls-paywall {
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
.ls-paywall .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function PaywallModal({
  isOpen,
  onClose,
  onUpgrade,
  triggerReason,
}: PaywallModalProps) {
  const triggerCopy = TRIGGER_COPY[triggerReason] ?? 'upgrade for the full experience.'

  const handleUpgrade = () => {
    onClose()
    onUpgrade()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-paywall">
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
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.985 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ls-paywall-title"
            className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] p-6 text-[var(--ls-text)] sm:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="close paywall"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
            >
              <X size={18} weight="regular" />
            </button>

            <div className="space-y-6">
              <div className="space-y-2 pr-9">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                  pro
                </p>

                <h2
                  id="ls-paywall-title"
                  className="font-fraunces text-3xl italic lowercase leading-tight text-[var(--ls-text)]"
                >
                  unlock everything
                </h2>

                <p className="text-sm leading-relaxed text-[var(--ls-text-muted)]">
                  {triggerCopy}
                </p>
              </div>

              <div className="grid gap-3 [@media(min-width:480px)]:grid-cols-2">
                <section className="rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg)]/25 p-5">
                  <h3 className="font-fraunces mb-3 text-lg italic lowercase text-[var(--ls-text-muted)]">
                    free
                  </h3>

                  <ul className="space-y-2.5">
                    {FREE_LINES.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm">
                        <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-[var(--ls-sand-dim)]" />
                        <span className="text-[var(--ls-text-muted)]">{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section
                  className="rounded-md border border-[var(--ls-border)] border-l-[var(--ls-sand)] bg-[var(--ls-sand)]/6 p-5"
                  data-testid="paywall-pro-price"
                >
                  <h3 className="font-fraunces mb-3 text-lg italic lowercase text-[var(--ls-text)]">
                    pro
                  </h3>

                  <ul className="space-y-2.5">
                    {PRO_LINES.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm">
                        <Check
                          size={14}
                          weight="regular"
                          className="mt-1 shrink-0 text-[var(--ls-sand)]"
                        />
                        <span className="text-[var(--ls-text)]">{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleUpgrade}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-[var(--ls-sand)] px-5 font-fraunces text-lg italic lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  see pro
                </button>

                <p className="text-center text-xs lowercase text-[var(--ls-text-subtle)]">
                  {PRICING.trialDays}-day trial, cancel anytime
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
