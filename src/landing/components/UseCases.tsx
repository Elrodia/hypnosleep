import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { USE_CASE_IDS, type UseCaseId } from '../data/useCases'
import { testimonials } from '../data/testimonials'
import { GlassCard } from './shared/GlassCard'
import { Button } from './shared/Button'

interface UseCasesProps {
  onCtaClick: (location: string) => void
}

export function UseCases({ onCtaClick }: UseCasesProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState<UseCaseId>(USE_CASE_IDS[0])
  const currentLabel = t(`useCases.items.${active}.label`)
  const currentDescription = t(`useCases.items.${active}.description`)
  const quotes = testimonials[active] ?? []

  return (
    <section className="relative py-20 sm:py-28" aria-label={t('useCases.title')}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-10">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">{t('useCases.eyebrow')}</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">{t('useCases.title')}</h2>
        </header>

        {/* Tab strip. Horizontally scrollable on mobile so touch targets stay big. */}
        <div
          role="tablist"
          aria-label={t('useCases.title')}
          className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap"
        >
          {USE_CASE_IDS.map((id) => {
            const selected = id === active
            return (
              <button
                key={id}
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                onClick={() => setActive(id)}
                className={
                  'shrink-0 rounded-full px-4 py-2 text-sm transition ' +
                  (selected
                    ? 'bg-[var(--ls-sand)] text-[var(--ls-bg)]'
                    : 'border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:text-[var(--ls-text)]')
                }
              >
                {t(`useCases.items.${id}.label`)}
              </button>
            )
          })}
        </div>

        <div className="relative mt-8 min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              role="tabpanel"
              id={`panel-${active}`}
              aria-labelledby={`tab-${active}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={
                quotes.length > 0
                  ? 'grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-start'
                  : 'max-w-2xl'
              }
            >
              <GlassCard className="p-6 sm:p-7 bg-[var(--ls-bg-elevated)] border border-[var(--ls-border)] rounded-md">
                <h3 className="ls-display text-2xl mb-3">{currentLabel}</h3>
                <p className="text-[var(--ls-text-muted)] leading-relaxed mb-6">
                  {currentDescription}
                </p>
                <Button
                  variant="outline"
                  trailingIcon={<ArrowRight size={16} />}
                  onClick={() => onCtaClick(`use_case_${active}`)}
                >
                  {t('useCases.tryFreeButton', { label: currentLabel.toLowerCase() })}
                </Button>
              </GlassCard>

              {quotes.length > 0 && (
                <ul className="grid sm:grid-cols-2 gap-4">
                  {quotes.map((q) => (
                    <li key={q.name}>
                      <GlassCard className="p-5 h-full bg-[var(--ls-bg-elevated)] border border-[var(--ls-border)] rounded-md">
                        <p className="text-sm leading-relaxed text-[var(--ls-text)] mb-4">
                          &ldquo;{q.quote}&rdquo;
                        </p>
                        <div className="text-xs text-[var(--ls-text-muted)]">
                          <span className="text-[var(--ls-text)]">{q.name}</span> · {q.role}
                        </div>
                      </GlassCard>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
