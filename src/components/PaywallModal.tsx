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
  'free_limit': "you've used your free sessions for this month.",
  'premium-voice': 'this voice is part of pro.',
  'pro_voice': 'this voice is part of pro.',
  'pro_background': 'this background is part of pro.',
  'pro_duration': 'longer sessions are part of pro.',
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
  color: var(--ls-text);
}
.ls-paywall .ls-display {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-style: italic;
  text-transform: lowercase;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function PaywallModal({ isOpen, onClose, onUpgrade, triggerReason }: PaywallModalProps) {
  const triggerCopy = TRIGGER_COPY[triggerReason] ?? 'upgrade for the full experience.'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-paywall">
          <style>{STYLES}</style>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 backdrop-blur-md"
            style={{ backgroundColor: 'rgba(10, 10, 15, 0.85)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ls-paywall-title"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--ls-bg-elevated)',
              border: '1px solid var(--ls-border-strong)',
              maxHeight: 'calc(100vh - 2rem)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--ls-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ls-text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ls-text-muted)')}
            >
              <X size={20} weight="regular" />
            </button>

            <div className="space-y-6">
              <div className="space-y-2 pr-8">
                <h2
                  id="ls-paywall-title"
                  className="ls-display text-3xl"
                  style={{ color: 'var(--ls-text)' }}
                >
                  unlock everything
                </h2>
                <p className="text-sm" style={{ color: 'var(--ls-text-muted)' }}>
                  {triggerCopy}
                </p>
              </div>

              <div className="grid gap-3 [@media(min-width:480px)]:grid-cols-2">
                <div
                  className="rounded-md p-5"
                  style={{
                    backgroundColor: 'var(--ls-bg-elevated)',
                    border: '1px solid var(--ls-border)',
                  }}
                >
                  <h3 className="ls-display mb-3 text-lg" style={{ color: 'var(--ls-text-muted)' }}>
                    free
                  </h3>
                  <ul className="space-y-2.5">
                    {FREE_LINES.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm">
                        <span
                          className="mt-[0.55rem] inline-block h-1 w-1 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: 'var(--ls-sand-dim)' }}
                        />
                        <span style={{ color: 'var(--ls-text-muted)' }}>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  className="rounded-md p-5"
                  style={{
                    backgroundColor: 'var(--ls-bg-elevated)',
                    border: '1px solid var(--ls-border)',
                    borderLeft: '1px solid var(--ls-sand)',
                  }}
                  data-testid="paywall-pro-price"
                >
                  <h3 className="ls-display mb-3 text-lg" style={{ color: 'var(--ls-text)' }}>
                    pro
                  </h3>
                  <ul className="space-y-2.5">
                    {PRO_LINES.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-sm">
                        <Check
                          size={14}
                          weight="regular"
                          className="mt-1 flex-shrink-0"
                          style={{ color: 'var(--ls-sand)' }}
                        />
                        <span style={{ color: 'var(--ls-text)' }}>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onUpgrade()
                  }}
                  className="flex w-full items-center justify-center rounded-md font-medium tracking-wide transition-colors"
                  style={{
                    height: '48px',
                    backgroundColor: 'var(--ls-sand)',
                    color: 'var(--ls-bg)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  see pro
                </button>
                <p className="text-center text-xs" style={{ color: 'var(--ls-text-subtle)' }}>
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
