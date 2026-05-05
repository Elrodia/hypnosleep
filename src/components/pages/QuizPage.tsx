import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Moon, Cigarette, Heart, Ghost, Target, Scales, Pencil, Check, SunHorizon, Coffee, Clock } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface GoalOption {
  id: string
  icon: React.ElementType
}

interface TimeOption {
  id: string
  icon: React.ElementType
  recommended?: boolean
}

const goalOptions: GoalOption[] = [
  { id: 'confidence', icon: Shield },
  { id: 'sleep', icon: Moon },
  { id: 'smoking', icon: Cigarette },
  { id: 'anxiety', icon: Heart },
  { id: 'fears', icon: Ghost },
  { id: 'focus', icon: Target },
  { id: 'weight', icon: Scales },
  { id: 'custom', icon: Pencil },
]

const timeOptions: TimeOption[] = [
  { id: 'before-sleep', icon: Moon, recommended: true },
  { id: 'morning', icon: SunHorizon },
  { id: 'breaks', icon: Coffee },
  { id: 'anytime', icon: Clock },
]

const durationOptions = [
  { value: 5 },
  { value: 10 },
] as const

interface QuizPageProps {
  onComplete: (data: {
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  }) => void
}

export function QuizPage({ onComplete }: QuizPageProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [duration, setDuration] = useState<5 | 10>(5)

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((current) =>
      current.includes(goalId)
        ? current.filter((id) => id !== goalId)
        : [...current, goalId],
    )
  }

  const handleStep1Continue = () => {
    if (selectedGoals.length > 0) setStep(2)
  }

  const handleStep2Continue = () => {
    if (selectedTime) setStep(3)
  }

  const handleStep3Complete = () => {
    onComplete({
      selectedGoals,
      preferredTime: selectedTime ?? 'before-sleep',
      sessionDuration: duration,
    })
  }

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ls-quiz min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)] p-6 pb-24"
    >
      <div className="max-w-2xl mx-auto">

        {/* ── Progress strip ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              {t('quiz.stepOf', { current: step, total: 3 })}
            </span>
            <span className="text-xs text-[var(--ls-text-subtle)]">
              {progress}%
            </span>
          </div>
          <div className="h-px w-full bg-[var(--ls-border)] relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[var(--ls-sand)]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1 — Goals ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="font-fraunces italic lowercase text-3xl mb-2 text-[var(--ls-text)]">
                  {t('quiz.step1Title')}
                </h1>
                <p className="text-sm text-[var(--ls-text-muted)] lowercase">
                  {t('quiz.step1Subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-10">
                {goalOptions.map((goal) => {
                  const Icon = goal.icon
                  const isSelected = selectedGoals.includes(goal.id)
                  return (
                    <motion.button
                      key={goal.id}
                      type="button"
                      onClick={() => toggleGoal(goal.id)}
                      whileTap={{ scale: 0.97 }}
                      className={`
                        relative flex flex-col items-center justify-center gap-3 p-5 rounded-md
                        bg-[var(--ls-bg-elevated)] border transition-colors
                        ${
                          isSelected
                            ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/[0.06]'
                            : 'border-[var(--ls-border)] hover:border-[var(--ls-border-strong)]'
                        }
                      `}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--ls-sand)] flex items-center justify-center"
                        >
                          <Check weight="regular" className="w-3 h-3 text-[var(--ls-bg)]" />
                        </motion.div>
                      )}
                      <Icon
                        weight="regular"
                        className={`w-9 h-9 transition-colors ${
                          isSelected ? 'text-[var(--ls-sand)]' : 'text-[var(--ls-text-muted)]'
                        }`}
                      />
                      <span
                        className={`text-sm text-center transition-colors lowercase ${
                          isSelected ? 'text-[var(--ls-text)]' : 'text-[var(--ls-text-muted)]'
                        }`}
                      >
                        {t(`quiz.goals.${goal.id}`)}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleStep1Continue}
                disabled={selectedGoals.length === 0}
                className="w-full h-12 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-sm lowercase disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                {t('quiz.continue')}
              </button>
            </motion.div>
          )}

          {/* ── STEP 2 — Time ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="font-fraunces italic lowercase text-3xl mb-2 text-[var(--ls-text)]">
                  {t('quiz.step2Title')}
                </h1>
              </div>

              <div className="flex flex-col gap-3 mb-10">
                {timeOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = selectedTime === option.id
                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedTime(option.id)}
                      whileTap={{ scale: 0.99 }}
                      className={`
                        relative flex items-center gap-4 p-4 rounded-md
                        bg-[var(--ls-bg-elevated)] border transition-colors text-left
                        ${
                          isSelected
                            ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/[0.06]'
                            : 'border-[var(--ls-border)] hover:border-[var(--ls-border-strong)]'
                        }
                      `}
                    >
                      <Icon
                        weight="regular"
                        className={`w-6 h-6 flex-shrink-0 transition-colors ${
                          isSelected ? 'text-[var(--ls-sand)]' : 'text-[var(--ls-text-muted)]'
                        }`}
                      />
                      <span
                        className={`flex-1 text-base transition-colors lowercase ${
                          isSelected ? 'text-[var(--ls-text)]' : 'text-[var(--ls-text-muted)]'
                        }`}
                      >
                        {t(`quiz.times.${option.id}`)}
                      </span>
                      {option.recommended && (
                        <span className="text-[10px] uppercase tracking-widest text-[var(--ls-text-subtle)]">
                          {t('quiz.recommended')}
                        </span>
                      )}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-[var(--ls-sand)] flex items-center justify-center flex-shrink-0"
                        >
                          <Check weight="regular" className="w-3 h-3 text-[var(--ls-bg)]" />
                        </motion.div>
                      )}
                    </motion.button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleStep2Continue}
                disabled={!selectedTime}
                className="w-full h-12 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-sm lowercase disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                {t('quiz.continue')}
              </button>
            </motion.div>
          )}

          {/* ── STEP 3 — Duration ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="font-fraunces italic lowercase text-3xl mb-2 text-[var(--ls-text)]">
                  {t('quiz.step3Title')}
                </h1>
                <p className="text-sm text-[var(--ls-text-muted)] lowercase">
                  {t('quiz.step3Subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-10">
                {durationOptions.map((opt) => {
                  const isSelected = duration === opt.value
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      whileTap={{ scale: 0.97 }}
                      className={`
                        py-6 rounded-md transition-colors border lowercase
                        ${
                          isSelected
                            ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/[0.06] text-[var(--ls-text)]'
                            : 'border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text-muted)] hover:border-[var(--ls-border-strong)]'
                        }
                      `}
                    >
                      <div className={`font-fraunces italic text-3xl mb-1 ${isSelected ? 'text-[var(--ls-sand)]' : ''}`}>
                        {opt.value}
                      </div>
                      <div className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                        {t('quiz.minutes')}
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleStep3Complete}
                className="w-full h-12 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-sm lowercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                {t('quiz.begin')}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )
}
