import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Logo } from './Logo'

export function SplashScreen() {
  const { t } = useTranslation()
  return (
    <motion.div
      className="ls-splash fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--ls-bg)] text-[var(--ls-text)]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {/* ── Logo with concentric breathing pulses ── */}
      <div className="relative flex items-center justify-center mb-12">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute rounded-full border"
            style={{
              borderColor: 'rgba(201, 182, 163, 0.35)', // sand at 35% alpha
            }}
            initial={{
              width: 60,
              height: 60,
              opacity: 0.6,
            }}
            animate={{
              width: [60, 180, 180],
              height: [60, 180, 180],
              opacity: [0.6, 0.15, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.4,
              ease: 'easeOut',
            }}
          />
        ))}

        <div className="relative rounded-2xl overflow-hidden">
          <Logo variant="mark" size={72} alt="" />
        </div>
      </div>

      {/* ── Wordmark ── */}
      <motion.h1
        className="font-fraunces italic lowercase text-4xl text-[var(--ls-text)] mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
      >
        {t('splash.wordmark')}
      </motion.h1>

      {/* ── Tagline ── */}
      <motion.p
        className="font-fraunces italic lowercase text-center text-sm text-[var(--ls-text-muted)] px-8 max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1, ease: 'easeOut' }}
      >
        {t('splash.tagline')}
      </motion.p>
    </motion.div>
  )
}
