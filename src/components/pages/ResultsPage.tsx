import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Moon, Clock, Sparkle } from '@phosphor-icons/react'

interface ResultsPageProps {
  selectedGoals: string[]
  preferredTime: string
  sessionDuration: number
  onStartSession: () => void
  onSkip: () => void
}

interface AmbientMote {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  delay: number
  duration: number
}

const goalLabels: Record<string, string> = {
  confidence: 'confidence',
  sleep: 'better sleep',
  smoking: 'quit smoking',
  anxiety: 'reduce anxiety',
  fears: 'overcome fears',
  focus: 'improve focus',
  weight: 'weight loss',
  custom: 'custom goal',
}

const timeLabels: Record<string, string> = {
  'before-sleep': 'before sleep',
  morning: 'morning routine',
  breaks: 'during breaks',
  anytime: 'anytime',
}

const STYLES = `
.ls-results {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-results .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function ResultsPage({
  selectedGoals,
  preferredTime,
  sessionDuration,
  onStartSession,
  onSkip,
}: ResultsPageProps) {
  const [motes, setMotes] = useState<AmbientMote[]>([])

  useEffect(() => {
    const nextMotes: AmbientMote[] = []

    for (let i = 0; i < 28; i++) {
      nextMotes.push({
        id: i,
        x: Math.random() * 100,
        y: 10 + Math.random() * 80,
        size: 1.5 + Math.random() * 3.5,
        opacity: 0.08 + Math.random() * 0.16,
        delay: Math.random() * 1.2,
        duration: 5 + Math.random() * 4,
      })
    }

    setMotes(nextMotes)
  }, [])

  const visibleGoals = selectedGoals.length > 0 ? selectedGoals : ['sleep']
  const firstGoalLabel = goalLabels[visibleGoals[0]] ?? visibleGoals[0]
  const preferredTimeLabel = timeLabels[preferredTime] ?? preferredTime

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className="ls-results relative min-h-screen overflow-hidden bg-[var(--ls-bg)] px-6 pb-24 pt-14 text-[var(--ls-text)]"
    >
      <style>{STYLES}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {motes.map((mote) => (
          <motion.span
            key={mote.id}
            initial={{
              x: `${mote.x}vw`,
              y: `${mote.y}vh`,
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              y: [`${mote.y}vh`, `${mote.y - 8}vh`, `${mote.y}vh`],
              opacity: [0, mote.opacity, 0],
              scale: [0.8, 1, 0.9],
            }}
            transition={{
              duration: mote.duration,
              delay: mote.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute rounded-full bg-[var(--ls-sand)]"
            style={{
              width: mote.size,
              height: mote.size,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl flex-col justify-center">
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.42, ease: 'easeOut' }}
          className="mb-9 text-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.22, duration: 0.34, ease: 'easeOut' }}
            className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]"
          >
            <Sparkle
              weight="regular"
              className="h-8 w-8 text-[var(--ls-sand)]"
            />
          </motion.div>

          <h1 className="font-fraunces italic lowercase text-4xl leading-tight text-[var(--ls-text)]">
            your plan is ready
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--ls-text-muted)]">
            a first session has been shaped around your goals, timing,
            and preferred duration.
          </p>
        </motion.div>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.36, ease: 'easeOut' }}
          className="mb-5 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/60 p-5"
          aria-label="Plan summary"
        >
          <div className="mb-5">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              your goals
            </h2>

            <div className="flex flex-wrap gap-2">
              {visibleGoals.map((goalId) => (
                <span
                  key={goalId}
                  className="rounded-full border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 px-3 py-1.5 text-sm lowercase text-[var(--ls-text)]"
                >
                  {goalLabels[goalId] ?? goalId}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-t border-[var(--ls-border)] pt-5 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-sand)]">
                <Moon weight="regular" className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                  preferred time
                </p>
                <p className="mt-1 text-sm lowercase text-[var(--ls-text)]">
                  {preferredTimeLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-sand)]">
                <Clock weight="regular" className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                  duration
                </p>
                <p className="mt-1 text-sm lowercase text-[var(--ls-text)]">
                  {sessionDuration} min
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.36, ease: 'easeOut' }}
          className="mb-6"
          aria-label="First session"
        >
          <h2 className="mb-3 px-1 text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
            your first session
          </h2>

          <motion.button
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={onStartSession}
            className="group w-full rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/70 p-5 text-left transition-colors hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-sand)]/6 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
          >
            <div className="flex items-center gap-5">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--ls-sand)] text-[var(--ls-sand)] transition-colors group-hover:bg-[var(--ls-sand)] group-hover:text-[var(--ls-bg)]">
                <Play weight="fill" className="ml-1 h-7 w-7" />

                <motion.span
                  className="absolute inset-0 rounded-full border border-[var(--ls-sand)]"
                  animate={{
                    scale: [1, 1.22, 1],
                    opacity: [0.28, 0, 0.28],
                  }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-fraunces italic lowercase text-2xl leading-tight text-[var(--ls-text)]">
                  {sessionDuration}-min {firstGoalLabel}
                </h3>

                <p className="mt-1 text-sm lowercase text-[var(--ls-text-muted)]">
                  generated for your first hypnosleep session
                </p>
              </div>
            </div>
          </motion.button>
        </motion.section>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.38, duration: 0.36, ease: 'easeOut' }}
          className="space-y-3"
        >
          <button
            type="button"
            onClick={onStartSession}
            className="h-14 w-full rounded-md bg-[var(--ls-sand)] px-6 font-fraunces text-lg italic lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
          >
            start my first session
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-md py-3 text-center text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
          >
            explore the app first
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
