import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { useCases } from '../data/useCases'
import { testimonials } from '../data/testimonials'
import { GlassCard } from './shared/GlassCard'
import { Button } from './shared/Button'

interface UseCasesProps {
  onCtaClick: (location: string) => void
}

export function UseCases({ onCtaClick }: UseCasesProps) {
  const [active, setActive] = useState(useCases[0].id)
  const current = useCases.find((u) => u.id === active)!
  const quotes = testimonials[active] ?? []

  return (
    <section className="relative py-20 sm:py-28" aria-label="Use cases">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ls-primary)] mb-3">Use cases</p>
          <h2 className="ls-display text-3xl sm:text-4xl mb-4">What are you here to change?</h2>
        </header>

        {/* Tab strip. Horizontally scrollable on mobile so touch targets stay big. */}
        <div
          role="tablist"
          aria-label="Use cases"
          className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap"
        >
          {useCases.map((u) => {
            const selected = u.id === active
            return (
              <button
                key={u.id}
                role="tab"
                aria-selected={selected}
                aria-controls={`panel-${u.id}`}
                id={`tab-${u.id}`}
                onClick={() => setActive(u.id)}
                className={
                  'shrink-0 rounded-full px-4 py-2 text-sm transition ' +
                  (selected
                    ? 'bg-[color:var(--ls-primary)] text-white'
                    : 'bg-white/5 text-[color:var(--ls-text-secondary)] border border-white/10 hover:text-[color:var(--ls-text)]')
                }
              >
                {u.label}
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
              className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-start"
            >
              <GlassCard className="p-6 sm:p-7">
                <h3 className="ls-display text-2xl mb-3">{current.label}</h3>
                <p className="text-[color:var(--ls-text-secondary)] leading-relaxed mb-6">
                  {current.description}
                </p>
                <Button
                  variant="outline"
                  trailingIcon={<ArrowRight size={16} />}
                  onClick={() => onCtaClick(`use_case_${current.id}`)}
                >
                  Try a {current.label} Session Free
                </Button>
              </GlassCard>

              <ul className="grid sm:grid-cols-2 gap-4">
                {quotes.map((q) => (
                  <li key={q.name}>
                    <GlassCard className="p-5 h-full">
                      <p className="text-sm leading-relaxed text-[color:var(--ls-text)] mb-4">
                        &ldquo;{q.quote}&rdquo;
                      </p>
                      <div className="text-xs text-[color:var(--ls-text-secondary)]">
                        <span className="text-[color:var(--ls-text)]">{q.name}</span> · {q.role}
                      </div>
                    </GlassCard>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
