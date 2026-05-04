import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from '@phosphor-icons/react'

interface PaymentSuccessScreenProps {
  onNavigateToCreate: () => void
  onNavigateToLibrary: () => void
  onAutoRedirect: () => void
}

interface CelebrationMote {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
  drift: number
  opacity: number
}

const STYLES = `
.ls-payment-success {
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
.ls-payment-success .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function PaymentSuccessScreen({
  onNavigateToCreate,
  onNavigateToLibrary,
  onAutoRedirect,
}: PaymentSuccessScreenProps) {
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [motes, setMotes] = useState<CelebrationMote[]>([])

  useEffect(() => {
    const nextMotes: CelebrationMote[] = Array.from({ length: 42 }, (_, index) => ({
      id: index,
      x: 15 + Math.random() * 70,
      y: 18 + Math.random() * 64,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 0.9,
      duration: 3.2 + Math.random() * 2.8,
      drift: -12 + Math.random() * 24,
      opacity: 0.14 + Math.random() * 0.24,
    }))

    setMotes(nextMotes)

    const checkmarkTimer = setTimeout(() => {
      setShowCheckmark(true)
    }, 500)

    const redirectTimer = setTimeout(() => {
      onAutoRedirect()
    }, 10000)

    return () => {
      clearTimeout(checkmarkTimer)
      clearTimeout(redirectTimer)
    }
  }, [onAutoRedirect])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ls-payment-success fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[var(--ls-bg)] px-6 text-[var(--ls-text)]"
    >
      <style>{STYLES}</style>

      <AnimatePresence>
        {motes.map((mote) => (
          <motion.span
            key={mote.id}
            initial={{
              x: `${mote.x}vw`,
              y: `${mote.y}vh`,
              scale: 0,
              opacity: 0,
            }}
            animate={{
              x: [`${mote.x}vw`, `${mote.x + mote.drift}vw`, `${mote.x}vw`],
              y: [`${mote.y}vh`, `${mote.y - 8}vh`, `${mote.y}vh`],
              scale: [0, 1, 0.75, 0],
              opacity: [0, mote.opacity, mote.opacity * 0.45, 0],
            }}
            transition={{
              duration: mote.duration,
              delay: mote.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute rounded-full bg-[var(--ls-sand)]"
            style={{
              width: mote.size,
              height: mote.size,
            }}
          />
        ))}
      </AnimatePresence>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: showCheckmark ? 1 : 0.92, opacity: showCheckmark ? 1 : 0 }}
          transition={{
            type: 'spring',
            stiffness: 180,
            damping: 22,
            delay: 0.15,
          }}
          className="mb-8"
        >
          <div className="relative flex h-32 w-32 items-center justify-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: showCheckmark ? [0.8, 1.06, 1] : 0.8,
                opacity: showCheckmark ? 1 : 0,
              }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.25 }}
              className="absolute inset-0 rounded-full border border-[var(--ls-sand)]"
            />

            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{
                scale: showCheckmark ? [0.7, 1.08, 1] : 0.7,
                opacity: showCheckmark ? 1 : 0,
              }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.45 }}
              className="flex h-24 w-24 items-center justify-center rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-sand)]"
            >
              <Check size={56} weight="regular" />
            </motion.div>

            <motion.span
              animate={{
                scale: [1, 1.24, 1],
                opacity: [0.22, 0, 0.22],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full border border-[var(--ls-sand)]/45"
              aria-hidden="true"
            />
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.36, ease: 'easeOut' }}
          className="mb-2 text-xs uppercase tracking-[0.22em] text-[var(--ls-text-subtle)]"
        >
          pro unlocked
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.08, duration: 0.38, ease: 'easeOut' }}
          className="font-fraunces mb-3 text-4xl italic lowercase leading-tight text-[var(--ls-text)]"
        >
          welcome to pro
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.38, ease: 'easeOut' }}
          className="mb-10 max-w-sm text-sm leading-relaxed text-[var(--ls-text-muted)]"
        >
          your full hypnosleep experience is now unlocked.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.38, ease: 'easeOut' }}
          className="flex w-full flex-col gap-3"
        >
          <button
            type="button"
            onClick={onNavigateToCreate}
            className="h-14 w-full rounded-md bg-[var(--ls-sand)] px-5 font-fraunces text-lg italic lowercase text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
          >
            create a custom session
          </button>

          <button
            type="button"
            onClick={onNavigateToLibrary}
            className="h-14 w-full rounded-md border border-[var(--ls-border-strong)] px-5 text-base lowercase text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
          >
            explore the library
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.36 }}
          className="mt-8 text-xs lowercase text-[var(--ls-text-subtle)]"
        >
          redirecting home in 10 seconds…
        </motion.p>
      </div>
    </motion.div>
  )
}
