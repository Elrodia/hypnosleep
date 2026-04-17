import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from './shared/Button'
import { Badge } from './shared/Badge'
import { GlassCard } from './shared/GlassCard'

interface PricingProps {
  onCtaClick: (location: string, plan?: 'free' | 'pro') => void
}

// Mandatory pattern per spec.
const MONTHLY = 19.99
const YEARLY = 119.99
const YEARLY_VS_MONTHLY = MONTHLY * 12 // 239.88
const YEARLY_SAVINGS = YEARLY_VS_MONTHLY - YEARLY // 119.88

const freeBullets = [
  '3 AI sessions / month',
  '30 pre-built templates',
  '2 voices',
  '30-second previews',
]

const proBullets = [
  'Unlimited AI sessions',
  'All 6 voices',
  'Background sound mixer',
  'Offline downloads',
  'Priority generation',
]

export function Pricing({ onCtaClick }: PricingProps) {
  // Yearly is default — anchors the user on the best-value tier and makes the
  // MRR math healthier. Monthly remains one click away for hesitant users.
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')

  const proPrice = billingPeriod === 'monthly' ? MONTHLY : YEARLY
  const proPriceLabel = billingPeriod === 'monthly' ? '/month' : '/year'

  return (
    <section id="pricing" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ls-primary)] mb-3">Pricing</p>
          <h2 className="ls-display text-3xl sm:text-4xl mb-4">Free to start. Pro when you're serious.</h2>
          <p className="text-[color:var(--ls-text-secondary)]">
            Seven days of Pro on the house. Cancel in one tap if it is not for you.
          </p>
        </header>

        {/* Toggle */}
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mx-auto mb-10 inline-flex w-full max-w-xs items-center rounded-full border border-white/10 bg-white/5 p-1"
        >
          {(['monthly', 'yearly'] as const).map((p) => {
            const selected = billingPeriod === p
            return (
              <button
                key={p}
                role="radio"
                aria-checked={selected}
                onClick={() => setBillingPeriod(p)}
                className={
                  'flex-1 rounded-full px-4 py-2 text-sm transition ' +
                  (selected ? 'bg-[color:var(--ls-primary)] text-white' : 'text-[color:var(--ls-text-secondary)]')
                }
              >
                {p === 'monthly' ? 'Monthly' : 'Yearly'}
                {p === 'yearly' && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[color:var(--ls-gold)]">
                    Save 50%
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="grid md:grid-cols-2 gap-5 items-stretch">
          {/* Free */}
          <GlassCard className="flex flex-col p-7">
            <div className="mb-6">
              <h3 className="ls-display text-2xl mb-1">Free</h3>
              <p className="text-sm text-[color:var(--ls-text-secondary)]">For dipping a toe in.</p>
            </div>
            <div className="mb-6">
              <span className="ls-display text-4xl">$0</span>
              <span className="text-[color:var(--ls-text-secondary)] text-sm">/forever</span>
            </div>
            <ul className="mb-8 space-y-3 flex-1">
              {freeBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="mt-0.5 text-[color:var(--ls-text-secondary)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" onClick={() => onCtaClick('pricing_free', 'free')}>
              Get Started Free
            </Button>
          </GlassCard>

          {/* Pro */}
          <GlassCard highlighted className="flex flex-col p-7 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge tone="gold">MOST POPULAR</Badge>
            </div>
            <div className="mb-6">
              <h3 className="ls-display text-2xl mb-1">Pro</h3>
              <p className="text-sm text-[color:var(--ls-text-secondary)]">
                Everything, unlimited, always on.
              </p>
            </div>

            <div className="mb-6">
              <span className="ls-display text-4xl">
                ${proPrice.toFixed(2)}
              </span>
              <span className="text-[color:var(--ls-text-secondary)] text-sm">{proPriceLabel}</span>
              {billingPeriod === 'yearly' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[color:var(--ls-text-secondary)] line-through">
                    ${YEARLY_VS_MONTHLY.toFixed(2)}
                  </span>
                  <Badge tone="success">Save ${YEARLY_SAVINGS.toFixed(0)}/year</Badge>
                </div>
              )}
            </div>

            <ul className="mb-8 space-y-3 flex-1">
              {proBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="mt-0.5 text-[color:var(--ls-primary)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button onClick={() => onCtaClick('pricing_pro', 'pro')}>Start 7-Day Free Trial</Button>
            <p className="mt-3 text-center text-xs text-[color:var(--ls-text-secondary)]">
              No charge until trial ends. Cancel anytime.
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
