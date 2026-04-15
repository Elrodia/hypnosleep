import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from '@phosphor-icons/react'

type ToastVariant = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const MAX_TOASTS = 3
const AUTO_DISMISS_DURATION = 3000

const variantStyles = {
  success: {
    bg: 'bg-emerald-500/90',
    icon: CheckCircle,
    iconColor: 'text-white'
  },
  error: {
    bg: 'bg-rose-500/90',
    icon: XCircle,
    iconColor: 'text-white'
  },
  info: {
    bg: 'bg-purple-500/90',
    icon: Info,
    iconColor: 'text-white'
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, message, variant }
    
    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, MAX_TOASTS)
      return updated
    })

    setTimeout(() => {
      hideToast(id)
    }, AUTO_DISMISS_DURATION)
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast, index) => {
            const variant = variantStyles[toast.variant]
            const Icon = variant.icon
            
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  transition: {
                    type: 'spring',
                    damping: 25,
                    stiffness: 400
                  }
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.8,
                  transition: {
                    duration: 0.2
                  }
                }}
                className={`${variant.bg} backdrop-blur-md rounded-full px-5 py-3 shadow-lg flex items-center gap-3 max-w-md w-full pointer-events-auto`}
                style={{
                  zIndex: 100 - index
                }}
              >
                <Icon size={20} weight="fill" className={variant.iconColor} />
                <span className="text-white text-sm font-medium flex-1 truncate">
                  {toast.message}
                </span>
                <button
                  onClick={() => hideToast(toast.id)}
                  className="text-white/80 hover:text-white transition-colors p-1 -mr-1"
                >
                  <X size={16} weight="bold" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
