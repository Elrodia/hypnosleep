import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

export function Pricing({ onCtaClick }: PricingProps) {
  const { t } = useTranslation()
  // Yearly is default — anchors the user on the best-value tier and makes the
  // MRR math healthier. Monthly remains one click away for hesitant users.
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly')

  const proPrice = billingPeriod === 'monthly' ? MONTHLY : YEARLY
  const proPriceLabel = billingPeriod === 'monthly' ? t('pricing.proPeriodMonth') : t('pricing.proPeriodYear')

  const freeBullets = [
    t('pricing.freeBullet1'),
    t('pricing.freeBullet2'),
    t('pricing.freeBullet3'),
    t('pricing.freeBullet4'),
  ]

  const proBullets = [
    t('pricing.proBullet1'),
    t('pricing.proBullet2'),
    t('pricing.proBullet3'),
    t('pricing.proBullet4'),
  ]

  return (
    <section id="pricing" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">{t('pricing.eyebrow')}</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">{t('pricing.title')}</h2>
          <p className="text-[var(--ls-text-muted)]">
            {t('pricing.subtitle')}
          </p>
        </header>

        {/* Toggle */}
        <div
          role="radiogroup"
          aria-label={t('pricing.ariaBilling')}
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
                {p === 'monthly' ? t('pricing.billingMonthly') : t('pricing.billingYearly')}
                {p === 'yearly' && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--ls-sand)]">
                    {t('pricing.saveBadge', { percent: YEARLY_SAVINGS_PCT })}
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
              <h3 className="ls-display text-2xl mb-1">{t('pricing.freeTitle')}</h3>
              <p className="text-sm text-[var(--ls-text-muted)]">{t('pricing.freeTagline')}</p>
            </div>
            <div className="mb-6">
              <span className="ls-display text-4xl">{t('pricing.freePrice')}</span>
              <span className="text-[var(--ls-text-muted)] text-sm">{t('pricing.freePeriod')}</span>
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
              {t('pricing.freeCta')}
            </Button>
          </GlassCard>

          {/* Pro */}
          <GlassCard highlighted className="flex flex-col p-7 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-[var(--ls-sand)] text-[var(--ls-bg)] text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                {t('pricing.mostPopular')}
              </span>
            </div>
            <div className="mb-6">
              <h3 className="ls-display text-2xl mb-1">{t('pricing.proTitle')}</h3>
              <p className="text-sm text-[var(--ls-text-muted)]">
                {t('pricing.proTagline')}
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
                  <Badge tone="success">
                    {t('pricing.yearlySaveBadge', { amount: YEARLY_SAVINGS.toFixed(0) })}
                  </Badge>
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
            <Button onClick={() => onCtaClick('pricing_pro', 'pro')}>{t('pricing.proCta')}</Button>
            <p className="mt-3 text-center text-xs text-[var(--ls-text-muted)]">
              {t('pricing.proDisclaimer')}
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
