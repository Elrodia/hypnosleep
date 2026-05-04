import { useTranslation } from 'react-i18next'
import { Button } from './shared/Button'

interface FinalCTAProps {
  onCtaClick: (location: string) => void
}

export function FinalCTA({ onCtaClick }: FinalCTAProps) {
  const { t } = useTranslation()
  return (
    <section className="relative py-24 sm:py-32 bg-[var(--ls-bg)]">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">
          {t('finalCta.title')}
        </h2>
        <p className="text-[var(--ls-text-muted)] mb-8">
          {t('finalCta.subtitle')}
        </p>
        <Button size="lg" onClick={() => onCtaClick('final_cta')}>
          {t('finalCta.button')}
        </Button>
      </div>
    </section>
  )
}
