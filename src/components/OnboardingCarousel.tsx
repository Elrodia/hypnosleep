import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import {
  Brain,
  Moon,
  TrendUp,
  Sparkle,
  Star,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'
import { Button } from './ui/button'

interface OnboardingCarouselProps {
  onComplete: () => void
}

interface SlideContent {
  title: string
  subtitle: string
  visual: ReactNode
}

function Slide1Visual() {
  return (
    <div className="relative">
      <motion.div
        animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
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
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
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
        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
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
  )
}

function Slide2Visual() {
  return (
    <div className="relative">
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <Moon size={120} weight="duotone" className="text-primary" />
      </motion.div>

      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8
        const radius = 80
        const x = Math.cos((angle * Math.PI) / 180) * radius
        const y = Math.sin((angle * Math.PI) / 180) * radius

        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: '50%', top: '50%', x, y }}
            animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
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
  )
}

function Slide3Visual() {
  return (
    <div className="relative">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        className="text-primary"
      >
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
        animate={{ y: [-10, -20, -10], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <TrendUp size={32} weight="bold" className="text-accent" />
      </motion.div>
    </div>
  )
}

const slides: SlideContent[] = [
  {
    title: 'AI-Powered Hypnosis',
    subtitle: 'Personalized sessions crafted by AI, just for you.',
    visual: <Slide1Visual />,
  },
  {
    title: 'Sleep Better Tonight',
    subtitle: 'Fall asleep faster with guided hypnosis before bed.',
    visual: <Slide2Visual />,
  },
  {
    title: 'Transform Your Mind',
    subtitle: 'Build confidence, break habits, overcome fears.',
    visual: <Slide3Visual />,
  },
]

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [direction, setDirection] = useState(1)
  const totalSlides = slides.length
  const isLast = currentSlide === totalSlides - 1
  const isFirst = currentSlide === 0

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1))
  }, [totalSlides])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrentSlide((s) => Math.max(s - 1, 0))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > currentSlide ? 1 : -1)
      setCurrentSlide(index)
    },
    [currentSlide],
  )

  const handleComplete = useCallback(() => {
    onComplete()
  }, [onComplete])

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const threshold = 50
    if (info.offset.x < -threshold && !isLast) {
      goNext()
    } else if (info.offset.x > threshold && !isFirst) {
      goPrev()
    }
  }

  // Keyboard navigation: ←/→ to move, Enter on the last slide to complete.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isLast) {
          handleComplete()
        } else {
          goNext()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goPrev()
      } else if (e.key === 'Enter' && isLast) {
        e.preventDefault()
        handleComplete()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, handleComplete, isLast])

  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 300 : -300,
    }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -300 : 300,
    }),
  }

  const slide = slides[currentSlide]

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Skip button */}
      <div className="flex justify-end p-4 pt-6">
        <button
          type="button"
          onClick={handleComplete}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Skip onboarding"
        >
          Skip
        </button>
      </div>

      {/* Slide stage */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center px-8"
          >
            <div className="mb-12">{slide.visual}</div>

            <h2 className="text-3xl font-semibold mb-4 text-center">
              {slide.title}
            </h2>
            <p className="text-muted-foreground text-center text-lg leading-relaxed max-w-sm">
              {slide.subtitle}
            </p>

            {isLast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-10"
              >
                <Button
                  size="lg"
                  onClick={handleComplete}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg font-medium rounded-full shadow-lg shadow-primary/20"
                >
                  Get Started
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Left arrow */}
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-card/70 backdrop-blur border border-border flex items-center justify-center text-foreground shadow-md transition-all duration-200 hover:bg-card hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <CaretLeft size={22} weight="bold" />
        </button>

        {/* Right arrow */}
        <motion.button
          type="button"
          onClick={isLast ? handleComplete : goNext}
          aria-label={isLast ? 'Get started' : 'Next slide'}
          animate={
            !isLast
              ? { scale: [1, 1.08, 1], boxShadow: [
                  '0 4px 12px rgba(0,0,0,0.15)',
                  '0 6px 20px rgba(0,0,0,0.25)',
                  '0 4px 12px rgba(0,0,0,0.15)',
                ] }
              : { scale: 1 }
          }
          transition={{ duration: 1.6, repeat: !isLast ? Infinity : 0, ease: 'easeInOut' }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md transition-colors duration-200 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CaretRight size={22} weight="bold" />
        </motion.button>
      </div>

      {/* Hint text */}
      <div className="px-6 pt-4 flex items-center justify-center">
        <motion.p
          key={isLast ? 'hint-last' : 'hint-next'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xs sm:text-sm text-muted-foreground text-center flex items-center gap-2"
        >
          {isLast ? (
            <>
              <span>You're all set — tap</span>
              <span className="font-medium text-foreground">Get Started</span>
              <span>to continue.</span>
            </>
          ) : (
            <>
              <span>Tap the</span>
              <CaretRight
                size={14}
                weight="bold"
                className="text-primary inline-block"
                aria-hidden="true"
              />
              <span>
                right arrow (or press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted/50 font-mono text-[10px] sm:text-xs">→</kbd>) to continue
              </span>
            </>
          )}
        </motion.p>
      </div>

      {/* Dot indicators */}
      <div className="pb-12 pt-6 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className="transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full p-1 -m-1"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={currentSlide === i ? 'true' : undefined}
          >
            <motion.div
              className="rounded-full"
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
