import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Input } from './ui/input'

interface SleepTimerModalProps {
  isOpen: boolean
  onClose: () => void
  onSetTimer: (minutes: number) => void
  onCancelTimer: () => void
  activeTimer: number | null
  remainingSeconds: number | null
}

const PRESET_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
]

export function SleepTimerModal({
  isOpen,
  onClose,
  onSetTimer,
  onCancelTimer,
  activeTimer,
  remainingSeconds,
}: SleepTimerModalProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('')

  const handlePresetClick = (minutes: number) => {
    onSetTimer(minutes)
    onClose()
  }

  const handleEndOfSession = () => {
    onSetTimer(-1)
    onClose()
  }

  const handleCustomSubmit = () => {
    const minutes = parseInt(customMinutes, 10)
    if (minutes > 0 && minutes <= 180) {
      onSetTimer(minutes)
      setCustomMinutes('')
      setShowCustomInput(false)
      onClose()
    }
  }

  const handleCancel = () => {
    onCancelTimer()
    onClose()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progressPercentage = activeTimer && remainingSeconds !== null
    ? ((activeTimer * 60 - remainingSeconds) / (activeTimer * 60)) * 100
    : 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mt-3 mb-4" />

            <div className="px-6 pb-8 overflow-y-auto max-h-[calc(85vh-2rem)]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-foreground">Sleep Timer</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {activeTimer !== null && remainingSeconds !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8 flex flex-col items-center"
                >
                  <div className="relative w-40 h-40 mb-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-muted"
                      />
                      <motion.circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        className="text-primary"
                        initial={{ strokeDasharray: '439.6 439.6', strokeDashoffset: 439.6 }}
                        animate={{ 
                          strokeDashoffset: 439.6 - (439.6 * progressPercentage) / 100 
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold text-foreground">
                        {formatTime(remainingSeconds)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">remaining</div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleCancel}
                    variant="destructive"
                    className="w-full max-w-xs"
                  >
                    Cancel Timer
                  </Button>
                </motion.div>
              )}

              {activeTimer === null && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {PRESET_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handlePresetClick(option.value)}
                        className="h-16 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-foreground font-medium text-lg active:scale-95 transition-transform"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleEndOfSession}
                    className="w-full h-16 rounded-xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 transition-colors text-primary font-medium text-lg active:scale-95 transition-transform"
                  >
                    End of Session
                  </button>

                  {!showCustomInput ? (
                    <button
                      onClick={() => setShowCustomInput(true)}
                      className="w-full h-16 rounded-xl bg-accent/50 hover:bg-accent transition-colors text-accent-foreground font-medium text-lg active:scale-95 transition-transform"
                    >
                      Custom
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 p-4 rounded-xl bg-accent/20 border border-accent/30"
                    >
                      <Label htmlFor="custom-minutes" className="text-sm font-medium">
                        Enter minutes (1-180)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="custom-minutes"
                          type="number"
                          min="1"
                          max="180"
                          value={customMinutes}
                          onChange={(e) => setCustomMinutes(e.target.value)}
                          placeholder="e.g., 90"
                          className="flex-1"
                        />
                        <Button
                          onClick={handleCustomSubmit}
                          disabled={!customMinutes || parseInt(customMinutes, 10) <= 0}
                          size="icon"
                          className="shrink-0"
                        >
                          <Check className="w-5 h-5" />
                        </Button>
                      </div>
                      <button
                        onClick={() => {
                          setShowCustomInput(false)
                          setCustomMinutes('')
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
