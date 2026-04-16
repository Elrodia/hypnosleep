import { useState } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { Brain, Moon, TrendUp, Sparkle, Star } from '@phosphor-icons/react'
import { Button } from './ui/button'
import { useKV } from '@github/spark/hooks'

interface OnboardingCarouselProps {
  onComplete: () => void
}

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 3

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x < -threshold && currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1)
    } else if (info.offset.x > threshold && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const handleComplete = () => {
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          {currentSlide === 0 && (
            <motion.div
              key="slide-1"
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 flex flex-col items-center justify-center px-8"
            >
              <div className="relative mb-12">
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Brain size={120} weight="duotone" className="text-primary" />
                </motion.div>
                
                <motion.div
                  className="absolute -top-4 -right-4"
                  animate={{
                    scale: [0, 1, 0],
                    rotate: [0, 180, 360],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Sparkle size={32} weight="fill" className="text-accent" />
                </motion.div>
                
                <motion.div
                  className="absolute -bottom-2 -left-2"
                  animate={{
                    scale: [0, 1, 0],
                    rotate: [0, -180, -360],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1,
                  }}
                >
                  <Sparkle size={24} weight="fill" className="text-accent" />
                </motion.div>
                
                <motion.div
                  className="absolute top-0 right-8"
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.5,
                  }}
                >
                  <Sparkle size={20} weight="fill" className="text-accent/70" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-semibold mb-4 text-center">
                AI-Powered Hypnosis
              </h2>
              <p className="text-muted-foreground text-center text-lg leading-relaxed max-w-sm">
                Personalized sessions crafted by AI, just for you.
              </p>
            </motion.div>
          )}

          {currentSlide === 1 && (
            <motion.div
              key="slide-2"
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 flex flex-col items-center justify-center px-8"
            >
              <div className="relative mb-12">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Moon size={120} weight="duotone" className="text-primary" />
                </motion.div>
                
                {[...Array(8)].map((_, i) => {
                  const angle = (i * 360) / 8
                  const radius = 80
                  const x = Math.cos((angle * Math.PI) / 180) * radius
                  const y = Math.sin((angle * Math.PI) / 180) * radius
                  
                  return (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={{
                        left: '50%',
                        top: '50%',
                        x: x,
                        y: y,
                      }}
                      animate={{
                        scale: [0, 1, 0],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.3,
                      }}
                    >
                      <Star size={16} weight="fill" className="text-accent" />
                    </motion.div>
                  )
                })}
              </div>

              <h2 className="text-3xl font-semibold mb-4 text-center">
                Sleep Better Tonight
              </h2>
              <p className="text-muted-foreground text-center text-lg leading-relaxed max-w-sm">
                Fall asleep faster with guided hypnosis before bed.
              </p>
            </motion.div>
          )}

          {currentSlide === 2 && (
            <motion.div
              key="slide-3"
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 flex flex-col items-center justify-center px-8"
            >
              <div className="relative mb-12">
                <svg width="120" height="120" viewBox="0 0 120 120" className="text-primary">
                  <motion.path
                    d="M 20 100 L 40 80 L 60 60 L 80 40 L 100 20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      repeatDelay: 1,
                    }}
                  />
                  
                  {[20, 40, 60, 80, 100].map((x, i) => {
                    const y = 100 - i * 20
                    return (
                      <motion.circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="6"
                        fill="currentColor"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{
                          duration: 0.5,
                          delay: i * 0.2,
                          repeat: Infinity,
                          repeatDelay: 2.5,
                        }}
                      />
                    )
                  })}
                </svg>
                
                <motion.div
                  className="absolute -top-2 right-0"
                  animate={{
                    y: [-10, -20, -10],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <TrendUp size={32} weight="bold" className="text-accent" />
                </motion.div>
              </div>

              <h2 className="text-3xl font-semibold mb-4 text-center">
                Transform Your Mind
              </h2>
              <p className="text-muted-foreground text-center text-lg leading-relaxed max-w-sm mb-8">
                Build confidence, break habits, overcome fears.
              </p>

              <Button
                size="lg"
                onClick={handleComplete}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg font-medium rounded-full shadow-lg shadow-primary/20"
              >
                Get Started
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pb-16 pt-8 flex items-center justify-center gap-2">
        {[...Array(totalSlides)].map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className="transition-all duration-300"
            aria-label={`Go to slide ${i + 1}`}
          >
            <motion.div
              className="rounded-full bg-muted"
              animate={{
                width: currentSlide === i ? 32 : 8,
                height: 8,
                backgroundColor:
                  currentSlide === i
                    ? 'var(--primary)'
                    : 'var(--muted)',
              }}
              transition={{ duration: 0.3 }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
