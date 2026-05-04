import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { useKV } from '@/hooks/use-kv'
import { toast } from 'sonner'
import { logMood } from '@/lib/api-endpoints'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  sessionTitle: string
  sessionDuration: number
  /** Backend session id; if null we skip the server-side mood log. */
  sessionId?: string | null
}

interface FeedbackEntry {
  id: string
  sessionTitle: string
  sessionDuration: number
  feeling: 'worse' | 'same' | 'better' | 'great' | 'amazing'
  notes: string
  timestamp: number
}

interface MoodRating {
  date: string
  mood: number
  sessionName: string
}

const feelings = [
  { id: 'worse', emoji: '😫', label: 'worse', moodValue: 1 },
  { id: 'same', emoji: '😐', label: 'same', moodValue: 2 },
  { id: 'better', emoji: '🙂', label: 'better', moodValue: 3 },
  { id: 'great', emoji: '😊', label: 'great', moodValue: 4 },
  { id: 'amazing', emoji: '🤩', label: 'amazing', moodValue: 5 },
] as const

type FeelingId = (typeof feelings)[number]['id']

const STYLES = `
.ls-feedback-modal {
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
.ls-feedback-modal .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function FeedbackModal({
  isOpen,
  onClose,
  sessionTitle,
  sessionDuration,
  sessionId,
}: FeedbackModalProps) {
  const [selectedFeeling, setSelectedFeeling] = useState<FeelingId | null>(null)
  const [notes, setNotes] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [feedbackHistory, setFeedbackHistory] = useKV<FeedbackEntry[]>('feedback-history', [])
  const [moodRatings, setMoodRatings] = useKV<MoodRating[]>('mood-ratings', [])

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

    const timestamp = Date.now()
    const date = new Date(timestamp)
    const dateString = date.toISOString().split('T')[0]

    const newEntry: FeedbackEntry = {
      id: timestamp.toString(),
      sessionTitle,
      sessionDuration,
      feeling: selectedFeeling,
      notes,
      timestamp,
    }

    const selectedFeelingData = feelings.find((f) => f.id === selectedFeeling)
    const moodValue = selectedFeelingData?.moodValue || 3

    const newMoodRating: MoodRating = {
      date: dateString,
      mood: moodValue,
      sessionName: sessionTitle,
    }

    setFeedbackHistory((current) => [newEntry, ...(current || [])])
    setMoodRatings((current) => [newMoodRating, ...(current || [])])

    // Persist to the backend so progress / mood-trend charts reflect
    // the rating across devices. Only meaningful for real sessions —
    // template/preview playback (no sessionId) stays local-only.
    if (sessionId) {
      void logMood({
        sessionId,
        rating: moodValue,
        note: notes.trim() ? notes.trim().slice(0, 500) : undefined,
      }).catch((err) => {
        // Non-fatal — the local KV mirror still drives the UI.
        console.warn('Failed to log mood to backend:', err)
      })
    }

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
        <div className="ls-feedback-modal">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 310 }}
            className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden rounded-t-md border-t border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text)]"
            role="dialog"
            aria-modal="true"
            aria-label="session feedback"
          >
            <div className="mx-auto mb-5 mt-3 h-1.5 w-12 rounded-full bg-[var(--ls-border-strong)]" />

            <div className="px-6 pb-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]">
                    session
                  </p>
                  <h2 className="font-fraunces text-2xl italic lowercase text-[var(--ls-text)]">
                    how do you feel?
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="close feedback"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  <X weight="regular" className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-6 grid grid-cols-5 gap-2">
                {feelings.map((feeling) => {
                  const selected = selectedFeeling === feeling.id

                  return (
                    <button
                      key={feeling.id}
                      type="button"
                      onClick={() => setSelectedFeeling(feeling.id)}
                      className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-md border p-2 transition-all ${
                        selected
                          ? 'scale-[1.03] border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8'
                          : 'border-[var(--ls-border)] bg-[var(--ls-bg)]/35 hover:border-[var(--ls-border-strong)] hover:bg-[var(--ls-bg)]/55 active:scale-[0.98]'
                      } focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]`}
                      aria-pressed={selected}
                    >
                      <span className="text-3xl" aria-hidden="true">
                        {feeling.emoji}
                      </span>
                      <span
                        className={`text-[11px] lowercase ${
                          selected ? 'text-[var(--ls-text)]' : 'text-[var(--ls-text-muted)]'
                        }`}
                      >
                        {feeling.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mb-6">
                <label htmlFor="feedback-notes" className="sr-only">
                  notes optional
                </label>

                <input
                  id="feedback-notes"
                  type="text"
                  placeholder="any notes? optional"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={200}
                  className="h-12 w-full rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg)] px-3 text-base text-[var(--ls-text)] placeholder:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                />

                <div className="mt-1 text-right text-[10px] tabular-nums text-[var(--ls-text-subtle)]">
                  {notes.length}/200
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!selectedFeeling}
                  className="h-12 w-full rounded-md bg-[var(--ls-sand)] px-5 font-fraunces text-lg italic lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 disabled:cursor-not-allowed disabled:bg-[var(--ls-bg)] disabled:text-[var(--ls-text-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  save and close
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="rounded-md py-2 text-sm lowercase text-[var(--ls-text-muted)] transition-colors hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  skip
                </button>
              </div>
            </div>
          </motion.div>

          {showConfetti && <ConfettiEffect />}
        </div>
      )}
    </AnimatePresence>
  )
}

function ConfettiEffect() {
  const particles = Array.from({ length: 36 })

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden">
      {particles.map((_, index) => (
        <motion.div
          key={index}
          initial={{
            x: '50vw',
            y: '55vh',
            scale: 0,
            opacity: 0,
          }}
          animate={{
            x: `${20 + Math.random() * 60}vw`,
            y: `${25 + Math.random() * 45}vh`,
            scale: [0, 1, 0.75, 0],
            opacity: [0, 0.38, 0.22, 0],
          }}
          transition={{
            duration: 1.6 + Math.random() * 0.5,
            ease: 'easeOut',
          }}
          className="absolute rounded-full bg-[var(--ls-sand)]"
          style={{
            width: 3 + Math.random() * 5,
            height: 3 + Math.random() * 5,
          }}
        />
      ))}
    </div>
  )
}
