import { motion } from 'framer-motion'
import { features } from '../data/features'
import { GlassCard } from './shared/GlassCard'

export function FeaturesGrid() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ls-primary)] mb-3">Features</p>
          <h2 className="ls-display text-3xl sm:text-4xl mb-4">
            Everything a good hypnotherapist would give you, without the 90€ copay
          </h2>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
            >
              <GlassCard className="h-full p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--ls-primary)]/15 text-[color:var(--ls-primary)]">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold mb-1.5 text-[color:var(--ls-text)]">{title}</h3>
                <p className="text-sm text-[color:var(--ls-text-secondary)] leading-relaxed">
                  {description}
                </p>
              </GlassCard>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
