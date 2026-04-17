import { motion } from 'framer-motion'
import { GlassCard } from './shared/GlassCard'

// "Screenshot" placeholders — we draw stylised mockups in pure CSS instead
// of shipping PNGs. Keeps LCP fast and means the visuals never drift from
// the real app colour palette.
function CreateMock() {
  return (
    <div className="rounded-xl bg-[color:var(--ls-surface)] p-4 border border-white/10 text-left">
      <div className="text-xs text-[color:var(--ls-text-secondary)] mb-2">What do you want to work on?</div>
      <div className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm">
        <span className="text-[color:var(--ls-text)]">Falling asleep faster on work nights</span>
        <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[color:var(--ls-primary)]" aria-hidden />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {['Sleep', '20 min', 'Calm voice'].map((t) => (
          <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{t}</span>
        ))}
      </div>
    </div>
  )
}

function GenerateMock() {
  return (
    <div className="rounded-xl bg-[color:var(--ls-surface)] p-5 border border-white/10 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full border-2 border-[color:var(--ls-primary)]/40 border-t-[color:var(--ls-primary)] animate-spin" aria-hidden />
      <div className="text-sm">Crafting your session…</div>
      <div className="mt-1 text-xs text-[color:var(--ls-text-secondary)]">Writing induction · deepening · suggestions</div>
    </div>
  )
}

function PlayerMock() {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#1a1a3a] to-[#12122a] p-5 border border-white/10">
      <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-gradient-to-br from-[#7c5cfc] to-[#5b8def] shadow-[0_10px_40px_-10px_rgba(124,92,252,0.7)]" aria-hidden />
      <div className="text-sm font-medium mb-1">Drift Into Deep Sleep</div>
      <div className="text-xs text-[color:var(--ls-text-secondary)] mb-3">Sleep · 18:24</div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-1/3 bg-[color:var(--ls-primary)]" />
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
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ls-primary)] mb-3">How it works</p>
          <h2 className="ls-display text-3xl sm:text-4xl mb-4">From "I want to change" to asleep in three minutes</h2>
          <p className="text-[color:var(--ls-text-secondary)]">
            No lengthy intake forms. No subscriptions to four apps. Just one goal, one AI, one
            session — tonight.
          </p>
        </header>

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Connector line — absolute positioned behind the cards on md+. */}
          <div
            className="hidden md:block absolute top-6 left-[8%] right-[8%] h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(124,92,252,0.5), rgba(91,141,239,0.5), transparent)',
            }}
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
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--ls-bg)] border border-[color:var(--ls-primary)]/50 text-[color:var(--ls-primary)] ls-display text-xl">
                  {i + 1}
                </span>
                <h3 className="ls-display text-xl leading-tight">{s.title}</h3>
              </div>
              <GlassCard className="p-4">{s.mock}</GlassCard>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
