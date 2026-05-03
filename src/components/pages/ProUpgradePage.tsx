import { useState } from 'react'
import { CaretLeft, Check, CircleNotch } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createCheckoutSession } from '@/lib/api-endpoints'
import { PRICING } from '@/config/pricing'

interface ProUpgradePageProps {
  onBack: () => void
}

const FEATURES: Array<{ title: string; description: string }> = [
  {
    title: 'unlimited ai sessions',
    description: 'generate as many personalized hypnosis sessions as you need.',
  },
  {
    title: 'all premium voices',
    description: 'access all 6 professional voices.',
  },
  {
    title: 'offline downloads',
    description: 'download sessions to listen anywhere.',
  },
  {
    title: 'every background sound',
    description: 'unlock all ambient and binaural backgrounds.',
  },
  {
    title: 'no advertisements',
    description: 'uninterrupted, ad-free listening.',
  },
  {
    title: 'priority generation',
    description: 'skip the queue with faster generation.',
  },
]

const STYLES = `
.ls-upgrade {
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
.ls-upgrade .ls-display {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-style: italic;
  text-transform: lowercase;
  font-weight: 400;
  letter-spacing: -0.01em;
}
.ls-upgrade a.ls-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}
`

export function ProUpgradePage({ onBack }: ProUpgradePageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly')
  const [isLoading, setIsLoading] = useState(false)

  const monthlyPrice = PRICING.monthlyPrice
  const yearlyPrice = PRICING.yearlyPrice
  const yearlyMonthly = yearlyPrice / 12
  const yearlySavingsDollars = monthlyPrice * 12 - yearlyPrice

  /**
   * Kick off a Stripe Checkout session on the backend and redirect
   * the browser to the hosted payment page. The backend derives the
   * price id from the `plan` string — we just pass the cycle.
   */
  const handleStartTrial = async () => {
    setIsLoading(true)
    try {
      const { url } = await createCheckoutSession({ plan: billingCycle })
      window.location.assign(url)
    } catch (err) {
      setIsLoading(false)
      toast.error(
        err instanceof Error ? err.message : 'Could not start checkout. Please try again.',
      )
    }
  }

  const isMonthly = billingCycle === 'monthly'

  return (
    <div className="ls-upgrade min-h-screen" style={{ backgroundColor: 'var(--ls-bg)' }}>
      <style>{STYLES}</style>

      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4"
        style={{
          height: '64px',
          backgroundColor: 'var(--ls-bg)',
          borderBottom: '1px solid var(--ls-border)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: 'var(--ls-text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ls-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ls-text-muted)')}
        >
          <CaretLeft size={18} weight="regular" />
          <span>back</span>
        </button>
        <h2
          className="ls-display"
          style={{ fontSize: '1.25rem', color: 'var(--ls-text)' }}
        >
          pro
        </h2>
        <div style={{ width: '48px' }} />
      </div>

      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <div className="text-center">
          <h1
            className="ls-display"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 3rem)', color: 'var(--ls-text)' }}
          >
            unlimited nights
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--ls-text-muted)' }}>
            generate as many sessions as you need.
          </p>
        </div>

        <ul className="mx-auto mt-12 max-w-[36rem] space-y-5">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-start gap-3">
              <Check
                size={20}
                weight="regular"
                className="mt-0.5 flex-shrink-0"
                style={{ color: 'var(--ls-sand)' }}
              />
              <div className="flex-1">
                <h3 className="text-base font-medium" style={{ color: 'var(--ls-text)' }}>
                  {feature.title}
                </h3>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--ls-text-muted)' }}>
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-12 flex max-w-[16rem] gap-2">
          {(['monthly', 'yearly'] as const).map((cycle) => {
            const active = billingCycle === cycle
            return (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                aria-pressed={active}
                className="flex-1 rounded-md px-4 py-2 text-sm transition-colors"
                style={{
                  backgroundColor: active ? 'var(--ls-sand)' : 'transparent',
                  color: active ? 'var(--ls-bg)' : 'var(--ls-text-muted)',
                  border: active
                    ? '1px solid var(--ls-sand)'
                    : '1px solid var(--ls-border-strong)',
                }}
              >
                {cycle}
              </button>
            )
          })}
        </div>

        <div
          className="mx-auto mt-6 max-w-[24rem] rounded-md p-8 text-center"
          style={{
            backgroundColor: 'var(--ls-bg-elevated)',
            border: '1px solid var(--ls-border)',
          }}
          data-testid="upgrade-pro-price"
        >
          <div className="flex items-baseline justify-center gap-1.5">
            <span
              className="ls-display"
              style={{ fontSize: '3rem', fontStyle: 'normal', textTransform: 'none', color: 'var(--ls-text)' }}
            >
              ${isMonthly ? monthlyPrice.toFixed(2) : yearlyPrice.toFixed(2)}
            </span>
            <span className="text-sm" style={{ color: 'var(--ls-text-muted)' }}>
              /{isMonthly ? 'month' : 'year'}
            </span>
          </div>
          {!isMonthly && (
            <div className="mt-3 space-y-1">
              <p className="text-sm" style={{ color: 'var(--ls-text-muted)' }}>
                just ${yearlyMonthly.toFixed(2)} / month
              </p>
              <p className="text-sm" style={{ color: 'var(--ls-sand-dim)' }}>
                save ${yearlySavingsDollars.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleStartTrial}
          disabled={isLoading}
          className="mx-auto mt-6 flex w-full max-w-[24rem] items-center justify-center rounded-md font-medium tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            height: '56px',
            backgroundColor: 'var(--ls-sand)',
            color: 'var(--ls-bg)',
          }}
        >
          {isLoading ? (
            <>
              <CircleNotch size={20} className="mr-2 animate-spin" />
              redirecting…
            </>
          ) : (
            `start ${PRICING.trialDays}-day trial`
          )}
        </button>

        <div className="mt-4 space-y-1.5 text-center">
          <p className="text-xs" style={{ color: 'var(--ls-text-subtle)' }}>
            cancel anytime · no charge until trial ends
          </p>
          <p className="text-xs" style={{ color: 'var(--ls-text-subtle)' }}>
            by continuing, you agree to our{' '}
            <a href="/terms" className="ls-link">
              terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="ls-link">
              privacy policy
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
