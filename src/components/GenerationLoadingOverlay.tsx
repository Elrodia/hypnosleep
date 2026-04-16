import { motion, AnimatePresence } from 'framer-motion'
import { X, PenNib, Waveform, MusicNote, Sparkle, Check } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

interface GenerationStep {
  id: number
  label: string
  icon: React.ReactNode
  status: 'pending' | 'active' | 'complete'
}

interface GenerationLoadingOverlayProps {
  isOpen: boolean
  onCancel: () => void
}

export function GenerationLoadingOverlay({ isOpen, onCancel }: GenerationLoadingOverlayProps) {
  const [steps, setSteps] = useState<GenerationStep[]>([
    { id: 1, label: 'Crafting your script...', icon: <PenNib weight="duotone" />, status: 'active' },
    { id: 2, label: 'Generating audio...', icon: <Waveform weight="duotone" />, status: 'pending' },
    { id: 3, label: 'Adding background sounds...', icon: <MusicNote weight="duotone" />, status: 'pending' },
    { id: 4, label: 'Finalizing session...', icon: <Sparkle weight="duotone" />, status: 'pending' },
  ])

  useEffect(() => {
    if (!isOpen) {
      setSteps([
        { id: 1, label: 'Crafting your script...', icon: <PenNib weight="duotone" />, status: 'active' },
        { id: 2, label: 'Generating audio...', icon: <Waveform weight="duotone" />, status: 'pending' },
        { id: 3, label: 'Adding background sounds...', icon: <MusicNote weight="duotone" />, status: 'pending' },
        { id: 4, label: 'Finalizing session...', icon: <Sparkle weight="duotone" />, status: 'pending' },
      ])
      return
    }

    const timings = [0, 7000, 14000, 21000]
    const timeouts: ReturnType<typeof setTimeout>[] = []

    timings.forEach((delay, index) => {
      const timeout = setTimeout(() => {
        setSteps(prev => {
          const updated = [...prev]
          if (index > 0) {
            updated[index - 1].status = 'complete'
          }
          if (index < updated.length) {
            updated[index].status = 'active'
          }
          return updated
        })
      }, delay)
      timeouts.push(timeout)
    })

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout))
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl"
        >
          <div className="flex flex-col items-center justify-center px-6 w-full max-w-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
              className="relative w-64 h-64 mb-12"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="w-full h-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, oklch(0.58 0.18 285) 50%, oklch(0.48 0.22 290) 100%)',
                    borderRadius: '50%',
                    filter: 'blur(20px)',
                  }}
                />
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                  className="w-4/5 h-4/5"
                  style={{
                    background: 'conic-gradient(from 180deg, oklch(0.48 0.22 290) 0%, transparent 50%, oklch(0.58 0.18 285) 100%)',
                    borderRadius: '50%',
                    filter: 'blur(15px)',
                  }}
                />
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className="w-3/5 h-3/5"
                  style={{
                    background: 'conic-gradient(from 90deg, transparent 0%, oklch(0.58 0.18 285) 50%, oklch(0.48 0.22 290) 100%)',
                    borderRadius: '50%',
                    filter: 'blur(10px)',
                  }}
                />
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.6, 0.8, 0.6]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-2/5 h-2/5 rounded-full bg-primary"
                  style={{
                    boxShadow: '0 0 60px 20px oklch(0.58 0.18 285 / 0.5)',
                  }}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="w-full space-y-4 mb-8"
            >
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
                  className="flex items-center gap-4 p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary/50 text-foreground shrink-0">
                    {step.status === 'complete' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                      >
                        <Check size={24} weight="bold" className="text-primary" />
                      </motion.div>
                    ) : step.status === 'active' ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="text-primary"
                      >
                        {step.icon}
                      </motion.div>
                    ) : (
                      <div className="text-muted-foreground/50">
                        {step.icon}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium transition-colors duration-300 ${
                      step.status === 'complete' 
                        ? 'text-muted-foreground line-through' 
                        : step.status === 'active' 
                        ? 'text-foreground' 
                        : 'text-muted-foreground/50'
                    }`}>
                      {step.label}
                    </p>
                  </div>

                  {step.status === 'active' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex gap-1"
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{
                            height: ['4px', '12px', '4px'],
                          }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: 'easeInOut',
                          }}
                          className="w-1 bg-primary rounded-full"
                        />
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="text-sm text-muted-foreground mb-6"
            >
              Estimated time: <span className="text-foreground font-medium">~30 seconds</span>
            </motion.p>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              onClick={onCancel}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground transition-colors duration-200"
            >
              <X size={18} />
              <span className="text-sm font-medium">Cancel Generation</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
