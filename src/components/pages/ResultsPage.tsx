import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Moon, Clock, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ResultsPageProps {
  selectedGoals: string[]
  preferredTime: string
  sessionDuration: number
  onStartSession: () => void
  onSkip: () => void
}

interface Confetti {
  id: number
  x: number
  y: number
  rotation: number
  color: string
  delay: number
  duration: number
}

const goalLabels: Record<string, string> = {
  confidence: 'Confidence',
  sleep: 'Better Sleep',
  smoking: 'Quit Smoking',
  anxiety: 'Reduce Anxiety',
  fears: 'Overcome Fears',
  focus: 'Improve Focus',
  weight: 'Weight Loss',
  custom: 'Custom Goal',
}

const timeLabels: Record<string, string> = {
  'before-sleep': 'Before Sleep',
  'morning': 'Morning Routine',
  'breaks': 'During Breaks',
  'anytime': 'Anytime',
}

export function ResultsPage({
  selectedGoals,
  preferredTime,
  sessionDuration,
  onStartSession,
  onSkip,
}: ResultsPageProps) {
  const [confetti, setConfetti] = useState<Confetti[]>([])

  useEffect(() => {
    const confettiColors = ['#7c5cfc', '#a78bfa', '#c4b5fd', '#ddd6fe', '#e0e7ff']
    const newConfetti: Confetti[] = []

    for (let i = 0; i < 50; i++) {
      newConfetti.push({
        id: i,
        x: Math.random() * 100,
        y: -20,
        rotation: Math.random() * 360,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        delay: Math.random() * 0.3,
        duration: 2 + Math.random() * 1.5,
      })
    }

    setConfetti(newConfetti)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background text-foreground p-6 pb-24 overflow-hidden relative"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((piece) => (
          <motion.div
            key={piece.id}
            initial={{
              x: `${piece.x}vw`,
              y: piece.y,
              rotate: piece.rotation,
              opacity: 1,
            }}
            animate={{
              y: '120vh',
              rotate: piece.rotation + 720,
              opacity: 0,
            }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: 'easeIn',
            }}
            className="absolute w-3 h-3 rounded-sm"
            style={{ backgroundColor: piece.color }}
          />
        ))}
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, type: 'spring', stiffness: 200 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: 'spring', stiffness: 150 }}
            className="inline-block mb-4"
          >
            <Sparkle weight="fill" className="w-16 h-16 text-primary" />
          </motion.div>
          
          <h1 className="text-4xl font-bold mb-2 font-serif">
            Your Plan is Ready!
          </h1>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="bg-card rounded-2xl p-6 mb-6 border border-border"
        >
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Your Goals</h3>
            <div className="flex flex-wrap gap-2">
              {selectedGoals.map((goalId) => (
                <Badge
                  key={goalId}
                  variant="secondary"
                  className="bg-primary/20 text-primary border-primary/30 px-3 py-1.5 text-sm"
                >
                  {goalLabels[goalId] || goalId}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Moon weight="duotone" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preferred Time</p>
                <p className="text-base font-medium">{timeLabels[preferredTime] || preferredTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock weight="duotone" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-base font-medium">{sessionDuration} min</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <h3 className="text-lg font-semibold mb-3 px-1">Your First Session</h3>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-br from-card to-card/50 rounded-2xl p-6 mb-6 border border-primary/30 relative overflow-hidden cursor-pointer group"
            onClick={onStartSession}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
            />

            <div className="relative z-10 flex items-center gap-5">
              <motion.div
                className="relative flex-shrink-0"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(124, 92, 252, 0.3)',
                    '0 0 40px rgba(124, 92, 252, 0.6)',
                    '0 0 20px rgba(124, 92, 252, 0.3)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Play weight="fill" className="w-8 h-8 text-primary-foreground ml-1" />
                </div>
                
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
              </motion.div>

              <div className="flex-1">
                <h4 className="text-xl font-semibold mb-1">10-min Confidence Boost</h4>
                <p className="text-sm text-muted-foreground">
                  AI-generated just for you
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="space-y-4"
        >
          <Button
            onClick={onStartSession}
            className="w-full h-14 text-lg font-semibold"
            size="lg"
          >
            Start My First Session
          </Button>

          <button
            onClick={onSkip}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Explore the app first
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
