import { ReactNode, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { X } from '@phosphor-icons/react'

interface SlideUpModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  showCloseButton?: boolean
}

const STYLES = `
.ls-slide-up-modal {
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
.ls-slide-up-modal .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function SlideUpModal({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
}: SlideUpModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="ls-slide-up-modal">
          <style>{STYLES}</style>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[var(--ls-bg)]/88"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'modal'}
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-md border-t border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text)]"
          >
            <div className="flex flex-col items-center border-b border-[var(--ls-border)] px-6 pb-4 pt-3">
              <div className="mb-4 h-1.5 w-12 cursor-grab rounded-full bg-[var(--ls-border-strong)] active:cursor-grabbing" />

              {title && (
                <div className="flex w-full items-center justify-between gap-4">
                  <h2 className="font-fraunces text-2xl italic lowercase text-[var(--ls-text)]">
                    {title}
                  </h2>

                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="close modal"
                      className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                    >
                      <X size={18} weight="regular" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
