import { motion } from 'framer-motion'
import { ShareNetwork } from '@phosphor-icons/react'
import { toast } from 'sonner'

const affirmations = [
  "I am worthy of deep, restful sleep and peaceful dreams.",
  "My mind is calm, my body is relaxed, and sleep comes naturally.",
  "I release all tension and welcome complete relaxation.",
  "Every breath I take brings me closer to peaceful sleep.",
  "I trust in my ability to achieve my goals.",
  "Confidence flows through me with every heartbeat.",
  "I am becoming the best version of myself each day.",
  "My potential is limitless and I embrace it fully.",
  "I choose peace over worry, calm over chaos.",
  "Sleep is my body's natural gift of restoration.",
  "I am safe, I am calm, I am ready for rest.",
  "My thoughts are quiet, my mind is clear.",
  "I deserve to rest deeply and wake refreshed.",
  "Each night, I grow stronger and more resilient.",
  "I let go of what I cannot control.",
  "My mind is powerful and focused.",
  "I am in control of my thoughts and emotions.",
  "Peace begins with me, within me.",
  "I attract positivity and repel negativity.",
  "My body knows how to heal itself through rest.",
  "I am grateful for this moment of stillness.",
  "Tomorrow will be better because I rested tonight.",
  "I honor my need for rest and renewal.",
  "Sleep is not a luxury, it is my right.",
  "I am confident in who I am becoming.",
  "My dreams reflect my highest potential.",
  "I choose thoughts that serve my wellbeing.",
  "Rest is productive, sleep is essential.",
  "I am enough, exactly as I am right now.",
  "Each day I grow more confident and capable.",
]

function getDayOfMonth(): number {
  return new Date().getDate()
}

function getTodaysAffirmation(): string {
  const day = getDayOfMonth()
  const index = (day - 1) % affirmations.length
  return affirmations[index]
}

export function DailyAffirmation() {
  const affirmation = getTodaysAffirmation()

  const handleShare = async () => {
    const shareText = `"${affirmation}" - HypnoSleep`
    
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        })
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(shareText)
        }
      }
    } else {
      copyToClipboard(shareText)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Affirmation copied to clipboard!')
    }).catch(() => {
      toast.error('Failed to copy affirmation')
    })
  }

  return (
    <div className="relative w-full h-32 rounded-2xl bg-card overflow-hidden border border-border shadow-lg">
      <motion.div
        className="absolute inset-0 bg-primary/10 blur-3xl"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.8, 1.1, 0.8],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-8">
        <div className="relative text-center">
          <span className="absolute -left-4 -top-2 text-6xl font-serif text-foreground/5 leading-none select-none pointer-events-none">
            "
          </span>
          <span className="absolute -right-4 -bottom-2 text-6xl font-serif text-foreground/5 leading-none select-none pointer-events-none">
            "
          </span>
          
          <p className="text-base font-serif italic text-foreground/80 leading-relaxed relative z-10">
            {affirmation}
          </p>
        </div>
      </div>

      <button
        onClick={handleShare}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm border border-border hover:bg-background/80 active:scale-95 transition-all flex items-center justify-center text-foreground/60 hover:text-foreground z-20"
        aria-label="Share affirmation"
      >
        <ShareNetwork size={16} weight="bold" />
      </button>
    </div>
  )
}
