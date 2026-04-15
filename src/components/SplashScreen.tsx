import { motion } from 'framer-motion'

export function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      <div className="relative flex items-center justify-center mb-12">
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute rounded-full border-2"
            style={{
              borderImage: 'linear-gradient(135deg, #7c5cfc, #9d7bff) 1',
              borderImageSlice: 1,
            }}
            initial={{ 
              width: 60, 
              height: 60, 
              opacity: 0.8,
              borderColor: '#7c5cfc',
            }}
            animate={{
              width: [60, 180, 180],
              height: [60, 180, 180],
              opacity: [0.8, 0.2, 0],
              borderColor: ['#7c5cfc', '#9d7bff', '#7c5cfc'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.4,
              ease: 'easeOut',
            }}
          />
        ))}
        
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#7c5cfc] to-[#9d7bff] flex items-center justify-center shadow-lg shadow-primary/50">
          <span className="text-3xl">🌙</span>
        </div>
      </div>

      <motion.h1
        className="text-4xl font-serif font-semibold text-foreground mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
      >
        HypnoSleep
      </motion.h1>

      <motion.p
        className="text-muted-foreground text-center text-sm px-8 max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1, ease: 'easeOut' }}
      >
        Rewire Your Mind While You Sleep
      </motion.p>
    </motion.div>
  )
}
