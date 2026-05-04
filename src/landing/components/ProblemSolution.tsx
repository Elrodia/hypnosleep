import { Moon, Heart, Flame } from 'lucide-react'
import { GlassCard } from './shared/GlassCard'

const items = [
  { icon: Moon, problem: "Can't fall asleep?", solution: 'Custom sleep hypnosis in 10 minutes.' },
  { icon: Heart, problem: 'Lacking confidence?', solution: 'Daily affirmation sessions tailored to your goal.' },
  { icon: Flame, problem: 'Want to break a habit?', solution: 'Targeted hypnosis that retrains your subconscious.' },
]

export function ProblemSolution() {
  return (
    <section className="relative py-20 sm:py-28" aria-label="What HypnoSleep helps with">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid md:grid-cols-3 gap-5">
        {items.map(({ icon: Icon, problem, solution }) => (
          <GlassCard key={problem} className="p-7 bg-[var(--ls-bg-elevated)] border border-[var(--ls-border)]">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--ls-border-strong)] text-[var(--ls-sand-dim)]">
              <Icon size={22} />
            </div>
            <h3 className="font-fraunces italic lowercase text-2xl mb-2 text-[var(--ls-text-muted)]">{problem}</h3>
            <p className="text-[var(--ls-text)] leading-relaxed">
              <span className="text-[var(--ls-sand)]">{solution}</span>
            </p>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
