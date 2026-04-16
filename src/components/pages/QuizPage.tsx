import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Moon, Cigarette, Heart, Ghost, Target, Scales, Pencil, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface GoalOption {
  id: string
  label: string
  icon: React.ElementType
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

interface QuizPageProps {
  onComplete: (selectedGoals: string[]) => void
}

export function QuizPage({ onComplete }: QuizPageProps) {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])

  const toggleGoal = (goalId: string) => {
    setSelectedGoals((current) => {
      if (current.includes(goalId)) {
        return current.filter((id) => id !== goalId)
      } else {
        return [...current, goalId]
      }
    })
  }

  const handleContinue = () => {
    if (selectedGoals.length > 0) {
      onComplete(selectedGoals)
    }
  }

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
            <span className="text-sm text-muted-foreground">Step 1 of 3</span>
            <span className="text-sm text-muted-foreground">33%</span>
          </div>
          <Progress value={33} className="h-2" />
        </div>

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
          onClick={handleContinue}
          disabled={selectedGoals.length === 0}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  )
}
