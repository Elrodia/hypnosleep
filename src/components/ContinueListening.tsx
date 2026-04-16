import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X } from '@phosphor-icons/react'
import { Progress } from '@/components/ui/progress'

interface ContinueListeningProps {
  sessionTitle: string
  category: string
  categoryColor: string
  progress: number
  durationRemaining: string
  onResume: () => void
  onDismiss: () => void
}

export function ContinueListening({
  sessionTitle,
  category,
  categoryColor,
  progress,
  durationRemaining,
  onResume,
  onDismiss,
}: ContinueListeningProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => {
      onDismiss()
    }, 300)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative"
        >
          <div
            className="relative overflow-hidden rounded-2xl bg-card shadow-lg border border-border"
            style={{
              borderLeftWidth: '4px',
              borderLeftColor: categoryColor,
            }}
          >
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${categoryColor}20`,
                        color: categoryColor,
                      }}
                    >
                      {category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold leading-snug mb-1">
                    {sessionTitle}
                  </h3>
                </div>
                
                <button
                  onClick={handleDismiss}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground font-medium">
                      {progress}% completed
                    </span>
                    <span className="text-muted-foreground">
                      {durationRemaining} remaining
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </div>

              <button
                onClick={onResume}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-98 transition-all shadow-lg shadow-primary/20"
              >
                <Play weight="fill" size={20} />
                Resume Session
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
