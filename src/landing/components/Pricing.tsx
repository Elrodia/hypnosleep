import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from './shared/Button'
import { Badge } from './shared/Badge'
import { GlassCard } from './shared/GlassCard'
import {
  PRICING,
  yearlyEquivalentOfMonthly,
  yearlySavings as YEARLY_SAVINGS,
  yearlySavingsPercent as YEARLY_SAVINGS_PCT,
} from '@/config/pricing'

interface PricingProps {
  onCtaClick: (location: string, plan?: 'free' | 'pro') => void
}

// Pricing values come from the centralized config so the landing page,
// paywall modal and upgrade page can never drift out of sync.
const MONTHLY = PRICING.monthlyPrice
const YEARLY = PRICING.yearlyPrice
const YEARLY_VS_MONTHLY = yearlyEquivalentOfMonthly

const freeBullets = [
  '2 sessions ever',
  '5-minute sessions',
  '1 voice',
  'Silence or rain background',
]

const proBullets = [
  '8 sessions per month',
  '3 to 12 minute sessions',
  'All 6 voices',
  'All 5 background sounds',
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
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">Pricing</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">free to start. pro when you're serious.</h2>
          <p className="text-[var(--ls-text-muted)]">
            Seven days of Pro on the house. Cancel in one tap if it is not for you.
          </p>
        </header>

        {/* Toggle */}
        <div
          role="radiogroup"
          aria-label="Billing period"
          className="mx-auto mb-10 inline-flex w-full max-w-xs items-center rounded-full border border-[var(--ls-border-strong)] p-1"
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
                  (selected ? 'bg-[var(--ls-sand)] text-[var(--ls-bg)]' : 'text-[var(--ls-text-muted)]')
                }
              >
                {p === 'monthly' ? 'Monthly' : 'Yearly'}
                {p === 'yearly' && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--ls-sand)]">
                    Save {YEARLY_SAVINGS_PCT}%
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
              <p className="text-sm text-[var(--ls-text-muted)]">For dipping a toe in.</p>
            </div>
            <div className="mb-6">
              <span className="ls-display text-4xl">$0</span>
              <span className="text-[var(--ls-text-muted)] text-sm">/forever</span>
            </div>
            <ul className="mb-8 space-y-3 flex-1">
              {freeBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="mt-0.5 text-[var(--ls-text-muted)]" />
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
              <span className="bg-[var(--ls-sand)] text-[var(--ls-bg)] text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                MOST POPULAR
              </span>
            </div>
            <div className="mb-6">
              <h3 className="ls-display text-2xl mb-1">Pro</h3>
              <p className="text-sm text-[var(--ls-text-muted)]">
                Everything, unlimited, always on.
              </p>
            </div>

            <div className="mb-6">
              <span className="ls-display text-4xl" data-testid="landing-pro-price">
                ${proPrice.toFixed(2)}
              </span>
              <span className="text-[var(--ls-text-muted)] text-sm" data-testid="landing-pro-period">{proPriceLabel}</span>
              {billingPeriod === 'yearly' && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[var(--ls-text-muted)] line-through">
                    ${YEARLY_VS_MONTHLY.toFixed(2)}
                  </span>
                  <Badge tone="success">Save ${YEARLY_SAVINGS.toFixed(0)}/year</Badge>
                </div>
              )}
            </div>

            <ul className="mb-8 space-y-3 flex-1">
              {proBullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <Check size={16} className="mt-0.5 text-[var(--ls-sand)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <Button onClick={() => onCtaClick('pricing_pro', 'pro')}>Start 7-Day Free Trial</Button>
            <p className="mt-3 text-center text-xs text-[var(--ls-text-muted)]">
              No charge until trial ends. Cancel anytime.
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
