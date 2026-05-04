import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from './shared/Button'

interface ExitIntentModalProps {
  open: boolean
  onClose: () => void
  onCtaClick: (location: string) => void
}

export function ExitIntentModal({ open, onClose, onCtaClick }: ExitIntentModalProps) {
  // Escape to close — respecting accessibility without needing a focus trap
  // library (the modal contains only two focusable elements). Also locks
  // body scroll while the modal is open so the page behind can't scroll,
  // matching the treatment used by the in-app SlideUpModal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative mx-auto w-full max-w-md rounded-2xl border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] p-7"
          >
            <button
              aria-label="Close"
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ls-border)] text-[var(--ls-text-muted)] hover:text-[var(--ls-text)]"
              onClick={onClose}
            >
              <X size={16} />
            </button>
            <h2 id="exit-title" className="font-fraunces italic lowercase text-2xl mb-2 text-[var(--ls-text)]">
              wait — try it tonight, on us
            </h2>
            <p className="text-[var(--ls-text-muted)] mb-6 leading-relaxed">
              Start your free trial — no credit card required. One tap to cancel if it is not for you.
            </p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                onCtaClick('exit_intent')
                onClose()
              }}
            >
              Start Free Trial
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
