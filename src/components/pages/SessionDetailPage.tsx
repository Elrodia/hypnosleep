import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShareNetwork, Heart, Play, Trash, Lock } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useKV } from '@/hooks/use-kv'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SessionDetailPageProps {
  sessionId: string
  onBack: () => void
  onPlay: () => void
}

interface SessionData {
  id: string
  title: string
  category: string
  duration: string
  gradient: string
  createdAt: number
  isFavorited?: boolean
  script: string
}

const categoryColors: Record<string, string> = {
  Sleep: 'from-indigo-600 via-indigo-500 to-indigo-700',
  Confidence: 'from-purple-600 via-purple-500 to-purple-700',
  Fears: 'from-violet-600 via-violet-500 to-violet-700',
  Habits: 'from-blue-600 via-blue-500 to-blue-700',
  Focus: 'from-teal-600 via-teal-500 to-teal-700',
  Custom: 'from-fuchsia-600 via-fuchsia-500 to-fuchsia-700',
}

const categoryTags: Record<string, string> = {
  Sleep: 'bg-indigo-600/90 text-indigo-50',
  Confidence: 'bg-purple-600/90 text-purple-50',
  Fears: 'bg-violet-600/90 text-violet-50',
  Habits: 'bg-blue-600/90 text-blue-50',
  Focus: 'bg-teal-600/90 text-teal-50',
  Custom: 'bg-fuchsia-600/90 text-fuchsia-50',
}

const sampleScript = `Close your eyes and take a deep breath in... and slowly exhale...

Feel your body beginning to relax as you sink deeper into comfort...

With each breath, you become more and more relaxed, letting go of all tension...

Your mind is calm, your body is at peace, and you are drifting into a state of deep relaxation...

Imagine yourself in a peaceful place, surrounded by tranquility and serenity...

Every muscle in your body is completely relaxed, from the top of your head to the tips of your toes...

You are safe, you are calm, and you are ready to embrace the profound rest that awaits you...

As you continue to breathe slowly and deeply, you feel yourself drifting further and further...`

export function SessionDetailPage({ sessionId, onBack, onPlay }: SessionDetailPageProps) {
  const [sessions] = useKV<SessionData[]>('library-sessions', [])
  const [isFavorited, setIsFavorited] = useState(false)
  const [isProUser] = useKV<boolean>('is-pro-user', false)

  const session = sessions?.find(s => s.id === sessionId) || {
    id: sessionId,
    title: 'Deep Sleep Journey',
    category: 'Sleep',
    duration: '20 min',
    gradient: 'from-indigo-600 to-purple-600',
    createdAt: Date.now(),
    isFavorited: false,
    script: sampleScript,
  }

  const gradient = categoryColors[session.category] || session.gradient
  const scriptLines = session.script.split('\n').filter(line => line.trim())
  const previewLines = scriptLines.slice(0, 3)
  const remainingLines = scriptLines.slice(3)

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const handleToggleFavorite = () => {
    setIsFavorited(!isFavorited)
    toast.success(isFavorited ? 'Removed from favorites' : 'Added to favorites')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: session.title,
          text: `Check out this hypnosis session: ${session.title}`,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          toast.error('Failed to share')
        }
      }
    } else {
      toast.success('Link copied to clipboard!')
    }
  }

  const handleDelete = () => {
    toast.success('Session deleted')
    setTimeout(() => {
      onBack()
    }, 500)
  }

  const handleUnlockPro = () => {
    toast.info('Upgrade to Pro to unlock full script access!')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background overflow-hidden"
    >
      <div className="h-full overflow-y-auto pb-32">
        <div className={cn(
          'relative h-64 bg-gradient-to-br',
          gradient
        )}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-3xl" />
          </div>

          <div className="relative h-full flex flex-col">
            <div className="flex items-center justify-between p-4">
              <motion.button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft weight="bold" size={20} />
              </motion.button>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                  whileTap={{ scale: 0.95 }}
                >
                  <ShareNetwork weight="bold" size={20} />
                </motion.button>

                <motion.button
                  onClick={handleToggleFavorite}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart
                    weight={isFavorited ? 'fill' : 'bold'}
                    size={20}
                    className={isFavorited ? 'text-red-400' : ''}
                  />
                </motion.button>
              </div>
            </div>

            <div className="flex-1" />

            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="px-5 -mt-8 relative z-10">
          <div className="bg-card rounded-3xl shadow-2xl p-6 border border-border/50">
            <h1 className="text-3xl font-serif font-semibold mb-4 leading-tight">
              {session.title}
            </h1>

            <div className="flex items-center gap-3 mb-2">
              <span className={cn(
                'inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-full',
                categoryTags[session.category] || 'bg-slate-600/90 text-slate-50'
              )}>
                {session.category}
              </span>

              <span className="text-sm text-muted-foreground font-medium">
                {session.duration}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Created {formattedDate}
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-4 px-1">Script Preview</h2>

            <div className="bg-card rounded-2xl p-5 border border-border relative overflow-hidden">
              <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
                {previewLines.map((line, index) => (
                  <p key={index} className="first-letter:text-primary first-letter:text-lg first-letter:font-semibold">
                    {line}
                  </p>
                ))}

                <div className="relative">
                  <div className="space-y-4 blur-sm select-none pointer-events-none">
                    {remainingLines.slice(0, 4).map((line, index) => (
                      <p key={index} className="text-muted-foreground/60">
                        {line}
                      </p>
                    ))}
                  </div>

                  {!isProUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-card via-card/95 to-transparent"
                    >
                      <div className="text-center px-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                          <Lock weight="fill" size={32} className="text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Unlock Full Script</h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                          Upgrade to Pro to read the complete hypnosis script and access advanced features
                        </p>
                        <Button
                          onClick={handleUnlockPro}
                          className="gap-2 bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_100%] animate-shimmer"
                        >
                          <Lock weight="fill" size={16} />
                          Unlock with Pro
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {isProUser && (
                    <div className="space-y-4 mt-4">
                      {remainingLines.slice(4).map((line, index) => (
                        <p key={index} className="text-sm leading-relaxed text-foreground/90">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pb-4">
            <button
              onClick={handleDelete}
              className="w-full text-center py-3 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
            >
              Delete Session
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent border-t border-border/50 backdrop-blur-xl z-20">
        <Button
          onClick={onPlay}
          size="lg"
          className="w-full h-14 text-lg font-semibold gap-3 shadow-lg shadow-primary/20"
        >
          <Play weight="fill" size={24} />
          Play Session
        </Button>
      </div>
    </motion.div>
  )
}
