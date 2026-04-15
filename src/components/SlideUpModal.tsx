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

export function SlideUpModal({ 
  isOpen, 
  onClose, 
  children, 
  title,
  showCloseButton = true 
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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 300,
              mass: 0.8
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
          >
            <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-border/50">
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-4 cursor-grab active:cursor-grabbing" />
              
              {title && (
                <div className="w-full flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 -mr-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
