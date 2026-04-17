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
          <GlassCard key={problem} className="p-7">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--ls-primary)]/15 text-[color:var(--ls-primary)]">
              <Icon size={22} />
            </div>
            <h3 className="ls-display text-2xl mb-2">{problem}</h3>
            <p className="text-[color:var(--ls-text-secondary)] leading-relaxed">{solution}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
