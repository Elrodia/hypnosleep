import { motion } from 'framer-motion'
import { features } from '../data/features'
import { GlassCard } from './shared/GlassCard'

export function FeaturesGrid() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-12">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">Features</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">
            everything a good hypnotherapist would give you, without the 90€ copay
          </h2>
        </header>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: (i % 2) * 0.08 }}
            >
              <GlassCard className="h-full p-6 bg-[var(--ls-bg-elevated)] border border-[var(--ls-border)]">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--ls-border-strong)] text-[var(--ls-sand)]">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold mb-1.5 text-[var(--ls-text)]">{title}</h3>
                <p className="text-sm text-[var(--ls-text-muted)] leading-relaxed">
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
