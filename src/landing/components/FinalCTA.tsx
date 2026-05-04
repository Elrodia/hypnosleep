import { Button } from './shared/Button'

interface FinalCTAProps {
  onCtaClick: (location: string) => void
}

export function FinalCTA({ onCtaClick }: FinalCTAProps) {
  return (
    <section className="relative py-24 sm:py-32 bg-[var(--ls-bg)]">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">
          your transformation starts tonight
        </h2>
        <p className="text-[var(--ls-text-muted)] mb-8">
          7-day free trial. no credit card. cancel anytime.
        </p>
        <Button size="lg" onClick={() => onCtaClick('final_cta')}>
          start free trial
        </Button>
      </div>
    </section>
  )
}
