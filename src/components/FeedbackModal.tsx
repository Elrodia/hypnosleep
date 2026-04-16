import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  sessionTitle: string
  sessionDuration: number
}

interface FeedbackEntry {
  id: string
  sessionTitle: string
  sessionDuration: number
  feeling: 'worse' | 'same' | 'better' | 'great' | 'amazing'
  notes: string
  timestamp: number
}

const feelings = [
  { id: 'worse', emoji: '😫', label: 'Worse' },
  { id: 'same', emoji: '😐', label: 'Same' },
  { id: 'better', emoji: '🙂', label: 'Better' },
  { id: 'great', emoji: '😊', label: 'Great' },
  { id: 'amazing', emoji: '🤩', label: 'Amazing' },
] as const

export function FeedbackModal({ isOpen, onClose, sessionTitle, sessionDuration }: FeedbackModalProps) {
  const [selectedFeeling, setSelectedFeeling] = useState<typeof feelings[number]['id'] | null>(null)
  const [notes, setNotes] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useKV<FeedbackEntry[]>('feedback-history', [])

  useEffect(() => {
    if (!isOpen) {
      setSelectedFeeling(null)
      setNotes('')
      setShowConfetti(false)
    }
  }, [isOpen])

  const handleSave = () => {
    if (!selectedFeeling) {
      toast.error('Please select how you feel')
      return
    }

    const newEntry: FeedbackEntry = {
      id: Date.now().toString(),
      sessionTitle,
      sessionDuration,
      feeling: selectedFeeling,
      notes,
      timestamp: Date.now(),
    }

    setFeedbackHistory((current) => [newEntry, ...(current || [])])

    if (selectedFeeling === 'amazing') {
      setShowConfetti(true)
      toast.success('Amazing! Keep up the great work! 🎉')
      setTimeout(() => {
        onClose()
      }, 2000)
    } else {
      toast.success('Feedback saved!')
      onClose()
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-4 mb-6" />

            <div className="px-6 pb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold tracking-tight">How do you feel?</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                >
                  <X weight="bold" className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 mb-6">
                {feelings.map((feeling) => (
                  <button
                    key={feeling.id}
                    onClick={() => setSelectedFeeling(feeling.id)}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                      selectedFeeling === feeling.id
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border bg-muted/50 hover:border-primary/50 hover:bg-muted active:scale-95'
                    }`}
                  >
                    <span className="text-4xl">{feeling.emoji}</span>
                    <span className="text-xs font-medium text-muted-foreground">{feeling.label}</span>
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <Input
                  placeholder="Any notes? (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-12 text-base"
                  maxLength={200}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!selectedFeeling}
                  className="w-full h-12 text-base font-medium"
                  size="lg"
                >
                  Save & Close
                </Button>

                <button
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  Skip
                </button>
              </div>
            </div>
          </motion.div>

          {showConfetti && <ConfettiEffect />}
        </>
      )}
    </AnimatePresence>
  )
}

function ConfettiEffect() {
  const particles = Array.from({ length: 50 })
  
  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          initial={{
            x: '50vw',
            y: '50vh',
            scale: 0,
            rotate: 0,
          }}
          animate={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            scale: [0, 1, 1, 0],
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: 1.5 + Math.random() * 0.5,
            ease: 'easeOut',
          }}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: [
              '#7c5cfc',
              '#a78bfa',
              '#c4b5fd',
              '#fbbf24',
              '#fb923c',
              '#f472b6',
            ][Math.floor(Math.random() * 6)],
          }}
        />
      ))}
    </div>
  )
}
