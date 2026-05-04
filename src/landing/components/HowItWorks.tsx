import { motion } from 'framer-motion'
import { GlassCard } from './shared/GlassCard'

// "Screenshot" placeholders — we draw stylised mockups in pure CSS instead
// of shipping PNGs. Keeps LCP fast and means the visuals never drift from
// the real app colour palette.
function CreateMock() {
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-4 border border-[var(--ls-border)] text-left">
      <div className="text-xs text-[var(--ls-text-muted)] mb-2">What do you want to work on?</div>
      <div className="rounded-lg bg-[var(--ls-bg)] border border-[var(--ls-border)] px-3 py-2 text-sm">
        <span className="text-[var(--ls-text)]">Falling asleep faster on work nights</span>
        <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[var(--ls-sand)]" aria-hidden />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {['Sleep', '20 min', 'Calm voice'].map((t) => (
          <span key={t} className="rounded-full border border-[var(--ls-border-strong)] px-2.5 py-1 text-[var(--ls-text-muted)]">{t}</span>
        ))}
      </div>
    </div>
  )
}

function GenerateMock() {
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-5 border border-[var(--ls-border)] text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full border-2 border-[var(--ls-border-strong)] border-t-[var(--ls-sand)] animate-spin" aria-hidden />
      <div className="text-sm text-[var(--ls-text)]">Crafting your session…</div>
      <div className="mt-1 text-xs text-[var(--ls-text-muted)]">Writing induction · deepening · suggestions</div>
    </div>
  )
}

function PlayerMock() {
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-5 border border-[var(--ls-border)]">
      <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-[var(--ls-sand)]" aria-hidden />
      <div className="text-sm font-medium mb-1 text-[var(--ls-text)]">Drift Into Deep Sleep</div>
      <div className="text-xs text-[var(--ls-text-muted)] mb-3">Sleep · 18:24</div>
      <div className="h-1 rounded-full bg-[var(--ls-border-strong)] overflow-hidden">
        <div className="h-full w-1/3 bg-[var(--ls-sand)]" />
      </div>
    </div>
  )
}

const steps = [
  { title: 'Tell us what you want to work on', mock: <CreateMock /> },
  { title: 'AI crafts your personal hypnosis script', mock: <GenerateMock /> },
  { title: 'Listen before sleep — wake up transformed', mock: <PlayerMock /> },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-14">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">How it works</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">from "i want to change" to asleep in three minutes</h2>
          <p className="text-[var(--ls-text-muted)]">
            No lengthy intake forms. No subscriptions to four apps. Just one goal, one AI, one
            session — tonight.
          </p>
        </header>

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Connector line — absolute positioned behind the cards on md+. */}
          <div
            className="hidden md:block absolute top-6 left-[8%] right-[8%] h-px bg-[var(--ls-border-strong)]"
            aria-hidden
          />
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ls-bg)] border border-[var(--ls-sand)] text-[var(--ls-sand)] ls-display text-xl">
                  {i + 1}
                </span>
                <h3 className="ls-display text-xl leading-tight text-[var(--ls-text)]">{s.title}</h3>
              </div>
              <GlassCard className="p-4">{s.mock}</GlassCard>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
