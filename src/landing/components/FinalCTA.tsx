import { Button } from './shared/Button'

interface FinalCTAProps {
  onCtaClick: (location: string) => void
}

export function FinalCTA({ onCtaClick }: FinalCTAProps) {
  return (
    <section className="relative py-20 sm:py-28" aria-label="Final call to action">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-14 sm:px-14 sm:py-20 text-center"
          style={{
            background:
              'radial-gradient(120% 140% at 0% 0%, rgba(124,92,252,0.45), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(91,141,239,0.35), transparent 55%), linear-gradient(135deg, #2a1a6e 0%, #1a1a5a 60%, #0f1040 100%)',
          }}
        >
          <h2 className="ls-display text-3xl sm:text-5xl mb-4 mx-auto max-w-3xl">
            Your transformation starts tonight
          </h2>
          <p className="text-[color:var(--ls-text-secondary)] mx-auto max-w-xl mb-8">
            7-day free trial. no credit card. cancel anytime.
          </p>
          <Button size="lg" pulse onClick={() => onCtaClick('final_cta')}>
            Start Free Trial
          </Button>
          <p className="mt-5 text-xs text-[color:var(--ls-text-secondary)]">
            No credit card required · 30-second signup · Cancel anytime
          </p>
        </div>
      </div>
    </section>
  )
}
