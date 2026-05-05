import { useTranslation } from 'react-i18next'

export function ProblemSolution() {
  const { t } = useTranslation()
  return (
    <section className="relative py-20 sm:py-28" aria-label={t('problemSolution.title')}>
      <div className="mx-auto max-w-3xl px-5 sm:px-8 text-center">
        <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
          {t('problemSolution.eyebrow')}
        </p>
        <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">
          {t('problemSolution.title')}
        </h2>
        <p className="text-[var(--ls-text-muted)] leading-relaxed">
          {t('problemSolution.body')}
        </p>
      </div>
    </section>
  )
}
