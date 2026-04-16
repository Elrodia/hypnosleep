import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'
import { Check } from '@phosphor-icons/react'

interface PaymentSuccessScreenProps {
  onNavigateToCreate: () => void
  onNavigateToLibrary: () => void
  onAutoRedirect: () => void
}

export function PaymentSuccessScreen({
  onNavigateToCreate,
  onNavigateToLibrary,
  onAutoRedirect,
}: PaymentSuccessScreenProps) {
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [confettiParticles, setConfettiParticles] = useState<Array<{
    id: number
    x: number
    y: number
    rotation: number
    color: string
    size: number
    delay: number
    duration: number
  }>>([])

  useEffect(() => {
    const particles = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10,
      rotation: Math.random() * 360,
      color: Math.random() > 0.5 ? '#7c5cfc' : '#ffd700',
      size: Math.random() * 10 + 5,
      delay: Math.random() * 0.3,
      duration: Math.random() * 1.5 + 1.5,
    }))
    setConfettiParticles(particles)

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
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6 overflow-hidden"
    >
      <AnimatePresence>
        {confettiParticles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}vw`,
              y: `${particle.y}vh`,
              rotate: particle.rotation,
              opacity: 1,
            }}
            animate={{
              x: `${particle.x + (Math.random() - 0.5) * 30}vw`,
              y: '110vh',
              rotate: particle.rotation + (Math.random() - 0.5) * 720,
              opacity: 0,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeIn',
            }}
            style={{
              position: 'absolute',
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '0%',
            }}
          />
        ))}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: showCheckmark ? 1 : 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 200, 
            damping: 20,
            delay: 0.3 
          }}
          className="mb-8"
        >
          <div className="relative w-32 h-32">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
            >
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: showCheckmark ? 1 : 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut', delay: 0.5 }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c5cfc" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: showCheckmark ? 1 : 0 }}
              transition={{ 
                type: 'spring', 
                stiffness: 200, 
                damping: 15,
                delay: 0.8 
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check size={64} weight="bold" className="text-primary" />
            </motion.div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.4 }}
          className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent"
        >
          Welcome to Pro!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.4 }}
          className="text-lg text-muted-foreground mb-10"
        >
          You've unlocked the full HypnoSleep experience.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.4 }}
          className="flex flex-col gap-4 w-full"
        >
          <Button
            size="lg"
            className="w-full text-lg h-14 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
            onClick={onNavigateToCreate}
          >
            Create Your First Custom Session
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full text-lg h-14 border-primary/30 hover:bg-primary/10"
            onClick={onNavigateToLibrary}
          >
            Explore the Library
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.4 }}
          className="text-sm text-muted-foreground mt-8"
        >
          Redirecting to home in 10 seconds...
        </motion.p>
      </div>
    </motion.div>
  )
}
