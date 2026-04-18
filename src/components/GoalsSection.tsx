import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Moon, Cigarette, Heart, Ghost, Target, Scales, Pencil, Check, Plus, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useKV } from '@/hooks/use-kv'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Goal {
  id: string
  label: string
  category: string
  targetSessions: number
  completedSessions: number
  color: string
}

const goalCategories = {
  confidence: { label: 'Confidence', icon: Shield, color: 'oklch(0.65 0.19 310)' },
  sleep: { label: 'Better Sleep', icon: Moon, color: 'oklch(0.60 0.18 265)' },
  smoking: { label: 'Quit Smoking', icon: Cigarette, color: 'oklch(0.55 0.15 30)' },
  anxiety: { label: 'Reduce Anxiety', icon: Heart, color: 'oklch(0.65 0.20 15)' },
  fears: { label: 'Overcome Fears', icon: Ghost, color: 'oklch(0.58 0.18 285)' },
  focus: { label: 'Improve Focus', icon: Target, color: 'oklch(0.60 0.18 200)' },
  weight: { label: 'Weight Loss', icon: Scales, color: 'oklch(0.62 0.19 140)' },
  custom: { label: 'Custom Goal', icon: Pencil, color: 'oklch(0.58 0.18 285)' },
}

export function GoalsSection() {
  const [goals, setGoals] = useKV<Goal[]>('user-goals', [])
  const [showAddGoalDialog, setShowAddGoalDialog] = useState(false)
  const [sessionData] = useKV<Record<string, { category: string }[]>>('completed-sessions', {})

  const calculateProgress = (goal: Goal): number => {
    let completedCount = 0
    
    Object.values(sessionData || {}).forEach((sessions) => {
      sessions.forEach((session) => {
        if (session.category === goal.category) {
          completedCount++
        }
      })
    })
    
    return Math.min(completedCount, goal.targetSessions)
  }

  const getProgressPercentage = (goal: Goal): number => {
    const completed = calculateProgress(goal)
    return Math.min((completed / goal.targetSessions) * 100, 100)
  }

  const isGoalCompleted = (goal: Goal): boolean => {
    return calculateProgress(goal) >= goal.targetSessions
  }

  const handleAddGoal = (categoryId: string) => {
    const category = goalCategories[categoryId as keyof typeof goalCategories]
    if (!category) return

    const goalExists = (goals || []).some(g => g.category === categoryId)
    if (goalExists) {
      toast.error('You already have this goal')
      return
    }

    const newGoal: Goal = {
      id: `${categoryId}-${Date.now()}`,
      label: category.label,
      category: categoryId,
      targetSessions: 10,
      completedSessions: 0,
      color: category.color,
    }

    setGoals((current) => [...(current || []), newGoal])
    setShowAddGoalDialog(false)
    toast.success('Goal added!')
  }

  const handleRemoveGoal = (goalId: string) => {
    setGoals((current) => (current || []).filter(g => g.id !== goalId))
    toast.success('Goal removed')
  }

  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold mb-3">Goals</h2>
      
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {(goals || []).map((goal, index) => {
            const completed = calculateProgress(goal)
            const percentage = getProgressPercentage(goal)
            const isCompleted = isGoalCompleted(goal)
            const Icon = goalCategories[goal.category as keyof typeof goalCategories]?.icon || Target

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
              >
                {isCompleted && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 3s linear infinite',
                    }}
                  />
                )}

                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: goal.color + '20' }}
                      >
                        <Icon size={20} weight="duotone" style={{ color: goal.color }} />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          {goal.label}
                          {isCompleted && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', bounce: 0.5 }}
                            >
                              <Check size={18} weight="bold" className="text-primary" />
                            </motion.div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {completed} of {goal.targetSessions} sessions completed
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveGoal(goal.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold" style={{ color: goal.color }}>
                        {Math.round(percentage)}%
                      </span>
                    </div>

                    <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: index * 0.1 }}
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ backgroundColor: goal.color }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        <Button
          variant="outline"
          className="w-full h-14 border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-200"
          onClick={() => setShowAddGoalDialog(true)}
        >
          <Plus size={20} weight="bold" className="mr-2" />
          Add New Goal
        </Button>
      </div>

      <Dialog open={showAddGoalDialog} onOpenChange={setShowAddGoalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkle size={24} weight="duotone" className="text-primary" />
              Add New Goal
            </DialogTitle>
            <DialogDescription>
              Choose a goal to track your progress
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {Object.entries(goalCategories).map(([key, category]) => {
              const Icon = category.icon
              const alreadyExists = (goals || []).some(g => g.category === key)

              return (
                <button
                  key={key}
                  onClick={() => handleAddGoal(key)}
                  disabled={alreadyExists}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    ${alreadyExists 
                      ? 'border-border bg-muted/30 opacity-50 cursor-not-allowed' 
                      : 'border-border hover:border-primary/50 hover:bg-primary/5 active:scale-95'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <Icon size={24} weight="duotone" style={{ color: category.color }} />
                    </div>
                    <span className="text-sm font-medium text-foreground text-center">
                      {category.label}
                    </span>
                    {alreadyExists && (
                      <span className="text-xs text-muted-foreground">Added</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
