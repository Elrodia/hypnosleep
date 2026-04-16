import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Moon, Cigarette, Heart, Ghost, Target, Scales, Pencil, Check, SunHorizon, Coffee, Clock } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface GoalOption {
  id: string
  label: string
  icon: React.ElementType
}

interface TimeOption {
  id: string
  label: string
  icon: React.ElementType
  recommended?: boolean
}

const goalOptions: GoalOption[] = [
  { id: 'confidence', label: 'Confidence', icon: Shield },
  { id: 'sleep', label: 'Better Sleep', icon: Moon },
  { id: 'smoking', label: 'Quit Smoking', icon: Cigarette },
  { id: 'anxiety', label: 'Reduce Anxiety', icon: Heart },
  { id: 'fears', label: 'Overcome Fears', icon: Ghost },
  { id: 'focus', label: 'Improve Focus', icon: Target },
  { id: 'weight', label: 'Weight Loss', icon: Scales },
  { id: 'custom', label: 'Custom Goal', icon: Pencil },
]

const timeOptions: TimeOption[] = [
  { id: 'before-sleep', label: 'Before Sleep', icon: Moon, recommended: true },
  { id: 'morning', label: 'Morning Routine', icon: SunHorizon },
  { id: 'breaks', label: 'During Breaks', icon: Coffee },
  { id: 'anytime', label: 'Anytime', icon: Clock },
]

interface QuizPageProps {
  onComplete: (selectedGoals: string[]) => void
}

export function QuizPage({ onComplete }: QuizPageProps) {
  const [step, setStep] = useState(1)
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((current) => {
      if (current.includes(goalId)) {
        return current.filter((id) => id !== goalId)
      } else {
        return [...current, goalId]
      }
    })
  }

  const handleStep1Continue = () => {
    if (selectedGoals.length > 0) {
      setStep(2)
    }
  }

  const handleStep2Continue = () => {
    if (selectedTime) {
      onComplete(selectedGoals)
    }
  }

  const progress = step === 1 ? 33 : 66

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background text-foreground p-6 pb-24"
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Step {step} of 3</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-semibold mb-2 font-serif">
                  What would you like to work on?
                </h1>
                <p className="text-muted-foreground">Pick all that apply.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                {goalOptions.map((goal) => {
                  const Icon = goal.icon
                  const isSelected = selectedGoals.includes(goal.id)

                  return (
                    <motion.button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg
                        bg-card border-2 transition-all duration-200
                        ${
                          isSelected
                            ? 'border-primary shadow-lg shadow-primary/20'
                            : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute top-2 right-2 bg-primary rounded-full p-1"
                        >
                          <Check weight="bold" className="w-4 h-4 text-primary-foreground" />
                        </motion.div>
                      )}

                      <Icon
                        weight="duotone"
                        className={`w-12 h-12 transition-colors ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium text-center transition-colors ${
                          isSelected ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {goal.label}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              <Button
                onClick={handleStep1Continue}
                disabled={selectedGoals.length === 0}
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                Continue
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h1 className="text-3xl font-semibold mb-2 font-serif">
                  When do you prefer to listen?
                </h1>
              </div>

              <div className="flex flex-col gap-3 mb-8">
                {timeOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = selectedTime === option.id

                  return (
                    <motion.button
                      key={option.id}
                      onClick={() => setSelectedTime(option.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        relative flex items-center gap-4 p-5 rounded-lg
                        bg-card border-2 transition-all duration-200
                        ${
                          isSelected
                            ? 'border-primary shadow-lg shadow-primary/30 bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="flex-shrink-0">
                        <Icon
                          weight="duotone"
                          className={`w-8 h-8 transition-colors ${
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      
                      <div className="flex-1 text-center">
                        <span
                          className={`text-base font-medium transition-colors ${
                            isSelected ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {option.label}
                        </span>
                      </div>

                      <div className="flex-shrink-0 w-8">
                        {option.recommended && (
                          <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                            Recommended
                          </Badge>
                        )}
                        {isSelected && !option.recommended && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check weight="bold" className="w-4 h-4 text-primary-foreground" />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <Button
                onClick={handleStep2Continue}
                disabled={!selectedTime}
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                Continue
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
