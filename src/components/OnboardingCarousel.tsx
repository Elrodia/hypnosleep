import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import {
  Sparkle,
  MoonStars,
  WaveSine,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'

interface OnboardingCarouselProps {
  onComplete: () => void
}

interface SlideContent {
  title: string
  subtitle: string
  visual: ReactNode
}

const STYLES = `
.ls-onboarding {
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
.ls-onboarding .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

/**
 * A single slowly-breathing glyph per slide. The animation is a
 * 4-second scale pulse from 1.00 to 1.04 and back — barely
 * perceptible, intentional, calming. No rotation, no orbital
 * decorations, no sparkles.
 */
function BreathingGlyph({ icon: Icon }: { icon: typeof Sparkle }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      className="text-[var(--ls-sand)]"
    >
      <Icon size={96} weight="regular" />
    </motion.div>
  )
}

const slides: SlideContent[] = [
  {
    title: 'sessions written for you.',
    subtitle:
      'tell us what you want to work on. an ai writes a fresh hypnosis script for that exact goal — no pre-recorded tracks.',
    visual: <BreathingGlyph icon={Sparkle} />,
  },
  {
    title: 'a calm voice, every night.',
    subtitle:
      'pick from six voices and an ambient background. listen before sleep, on a break, or whenever you have ten minutes.',
    visual: <BreathingGlyph icon={MoonStars} />,
  },
  {
    title: 'small changes, repeated.',
    subtitle:
      'hypnosis works through repetition. your library keeps every session, so you can return to the ones that resonate.',
    visual: <BreathingGlyph icon={WaveSine} />,
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
      if (index === currentSlide) return
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
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }
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
    <div className="ls-onboarding fixed inset-0 z-50 bg-[var(--ls-bg)] text-[var(--ls-text)] flex flex-col">
      <style>{STYLES}</style>

      {/* ── Skip button ── */}
      <div className="flex justify-end p-4 pt-6">
        <button
          type="button"
          onClick={handleComplete}
          className="text-sm text-[var(--ls-text-subtle)] hover:text-[var(--ls-text-muted)] transition-colors px-3 py-1.5 lowercase focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)] rounded-md"
          aria-label="Skip onboarding"
        >
          skip
        </button>
      </div>

      {/* ── Slide stage ── */}
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
            <div className="mb-14">{slide.visual}</div>

            <h2 className="font-fraunces italic lowercase text-3xl mb-4 text-center text-[var(--ls-text)] max-w-md">
              {slide.title}
            </h2>
            <p className="text-center text-base leading-relaxed max-w-sm text-[var(--ls-text-muted)]">
              {slide.subtitle}
            </p>

            {isLast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-12"
              >
                <button
                  type="button"
                  onClick={handleComplete}
                  className="px-10 h-12 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-sm lowercase focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  begin
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Left arrow ── */}
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous slide"
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-[var(--ls-border-strong)] bg-transparent flex items-center justify-center text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-[var(--ls-border-strong)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
        >
          <CaretLeft size={20} weight="regular" />
        </button>

        {/* ── Right arrow ── */}
        <button
          type="button"
          onClick={isLast ? handleComplete : goNext}
          aria-label={isLast ? 'Begin' : 'Next slide'}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full border border-[var(--ls-border-strong)] bg-transparent flex items-center justify-center text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
        >
          <CaretRight size={20} weight="regular" />
        </button>
      </div>

      {/* ── Dot indicators ── */}
      <div className="pb-12 pt-6 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className="transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)] rounded-full p-1 -m-1"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={currentSlide === i ? 'true' : undefined}
          >
            <motion.div
              className="rounded-full"
              animate={{
                width: currentSlide === i ? 28 : 6,
                height: 6,
                backgroundColor:
                  currentSlide === i
                    ? 'rgb(201, 182, 163)' // sand
                    : 'rgba(232, 230, 225, 0.16)', // border-strong
              }}
              transition={{ duration: 0.3 }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
