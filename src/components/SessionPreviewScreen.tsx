import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, PencilSimple, ArrowsClockwise, Check, Sparkle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface SessionPreviewScreenProps {
  isOpen: boolean
  sessionTitle: string
  category: string
  duration: string
  scriptText: string
  onListenNow: () => void
  onEditScript: () => void
  onRegenerate: () => void
  onClose: () => void
}

const SPARKLE_COUNT = 12

export function SessionPreviewScreen({
  isOpen,
  sessionTitle,
  category,
  duration,
  scriptText,
  onListenNow,
  onEditScript,
  onRegenerate,
  onClose,
}: SessionPreviewScreenProps) {
  const [showSparkles, setShowSparkles] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowSparkles(true)
      const timer = setTimeout(() => {
        setShowSparkles(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const sparkles = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * 360
    const radius = 80 + Math.random() * 40
    const x = Math.cos((angle * Math.PI) / 180) * radius
    const y = Math.sin((angle * Math.PI) / 180) * radius
    const delay = Math.random() * 0.5
    const duration = 1 + Math.random() * 0.5

    return { x, y, delay, duration, angle }
  })

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg"
        >
          <div className="h-full overflow-y-auto">
            <div className="min-h-full flex flex-col px-6 py-12">
              <div className="w-full max-w-2xl mx-auto space-y-8 flex-1">
                <div className="relative text-center pt-8">
                  <AnimatePresence>
                    {showSparkles && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
                        {sparkles.map((sparkle, i) => (
                          <motion.div
                            key={i}
                            initial={{
                              x: 0,
                              y: 0,
                              scale: 0,
                              opacity: 0,
                              rotate: 0,
                            }}
                            animate={{
                              x: sparkle.x,
                              y: sparkle.y,
                              scale: [0, 1.2, 1, 0],
                              opacity: [0, 1, 1, 0],
                              rotate: sparkle.angle,
                            }}
                            transition={{
                              duration: sparkle.duration,
                              delay: sparkle.delay,
                              ease: 'easeOut',
                            }}
                            className="absolute"
                          >
                            <Sparkle
                              weight="fill"
                              size={16 + Math.random() * 12}
                              className="text-primary"
                            />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>

                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-3xl font-semibold text-foreground mb-2"
                  >
                    Your Session is Ready!
                  </motion.h1>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-serif font-medium text-foreground">
                      {sessionTitle}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                      {category}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{duration}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div className="p-4 border-b border-border">
                    <h3 className="text-sm font-medium text-foreground">Script Preview</h3>
                  </div>
                  <ScrollArea className="h-[280px] px-6 py-5">
                    <div className="font-serif text-base leading-relaxed text-foreground/90 whitespace-pre-line">
                      {scriptText}
                    </div>
                  </ScrollArea>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground bg-card/30 border border-border/50 rounded-lg px-4 py-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                  >
                    <Check weight="bold" size={18} className="text-primary" />
                  </motion.div>
                  <span>Automatically saved to your library</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="space-y-3 pt-2"
                >
                  <Button
                    size="lg"
                    onClick={onListenNow}
                    className="w-full gap-3 text-lg font-semibold h-14 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <Play weight="fill" size={24} />
                    Listen Now
                  </Button>

                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={onEditScript}
                      className="flex-1 gap-2 font-medium h-12 border-2"
                    >
                      <PencilSimple size={20} />
                      Edit Script
                    </Button>
                  </div>

                  <button
                    onClick={onRegenerate}
                    className="flex items-center justify-center gap-2 w-full text-sm font-medium text-primary hover:text-primary/80 transition-colors py-3"
                  >
                    <ArrowsClockwise size={18} />
                    Regenerate Session
                  </button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
