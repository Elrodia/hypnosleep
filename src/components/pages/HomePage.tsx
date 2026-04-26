import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useKV } from '@/hooks/use-kv'
import { useAuth } from '@/lib/auth-context'
import { Play, Leaf, Star, Cloud, Eye, Heart, CaretRight, TrendUp, Headphones } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { StreakWidget } from '@/components/StreakWidget'
import { DailyAffirmation } from '@/components/DailyAffirmation'
import { ContinueListening } from '@/components/ContinueListening'
import { getTrendingSessions, type SessionSummary } from '@/lib/api-endpoints'
import { formatCategory } from '@/lib/session-ui'

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

interface QuickSession {
  id: string
  title: string
  duration: string
  category: string
  icon: typeof Leaf
  gradient: string
}

const quickSessions: QuickSession[] = [
  {
    id: 'calm',
    title: '5-min Calm',
    duration: '5 min',
    category: 'Calm',
    icon: Leaf,
    gradient: 'from-purple-600 via-purple-500 to-purple-600',
  },
  {
    id: 'confidence',
    title: '10-min Confidence',
    duration: '10 min',
    category: 'Confidence',
    icon: Star,
    gradient: 'from-blue-600 via-blue-500 to-blue-600',
  },
  {
    id: 'sleep',
    title: '10-min Sleep',
    duration: '10 min',
    category: 'Sleep',
    icon: Cloud,
    gradient: 'from-teal-600 via-teal-500 to-teal-600',
  },
  {
    id: 'focus',
    title: '15-min Focus',
    duration: '15 min',
    category: 'Focus',
    icon: Eye,
    gradient: 'from-indigo-600 via-indigo-500 to-indigo-600',
  },
  {
    id: 'anxiety',
    title: '5-min Anxiety Relief',
    duration: '5 min',
    category: 'Anxiety',
    icon: Heart,
    gradient: 'from-violet-600 via-violet-500 to-violet-600',
  },
]

interface PopularSession {
  id: string
  title: string
  category: string
  playCount: string
  duration: string
  gradient: string
}

const popularSessions: PopularSession[] = [
  {
    id: 'confidence-boost',
    title: 'Ultimate Confidence Boost',
    category: 'Self-Improvement',
    playCount: '12.4K',
    duration: '20 min',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
  },
  {
    id: 'deep-sleep',
    title: 'Deep Sleep Hypnosis',
    category: 'Sleep & Relaxation',
    playCount: '18.2K',
    duration: '30 min',
    gradient: 'from-indigo-600 via-purple-600 to-pink-600',
  },
  {
    id: 'anxiety-relief',
    title: 'Instant Anxiety Relief',
    category: 'Mental Health',
    playCount: '9.8K',
    duration: '15 min',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
]

interface UnfinishedSession {
  sessionTitle: string
  category: string
  categoryColor: string
  progress: number
  durationRemaining: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'Sleep & Relaxation': '#7c5cfc',
  'Self-Improvement': '#f59e0b',
  'Mental Health': '#10b981',
  'Focus': '#3b82f6',
  'Anxiety Relief': '#8b5cf6',
}

export function HomePage() {
  const { play } = useAudioPlayer()
  const { user } = useAuth()
  const userName = user?.name?.split(' ')[0] ?? 'Friend'
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay())
  const [unfinishedSession, setUnfinishedSession] = useKV<UnfinishedSession | null>(
    'unfinished-session',
    null,
  )

  const { data: trending } = useQuery({
    queryKey: ['sessions', 'trending'],
    queryFn: getTrendingSessions,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const featuredSession = trending?.find((session) => session.status === 'ready') ?? null

  const handlePlaySession = () => {
    if (!featuredSession) {
      toast.info('Your featured session is still being prepared. Try a Quick Session below.')
      return
    }

    play({
      sessionId: featuredSession.id,
      title: featuredSession.title,
      category: formatCategory(featuredSession.category),
      duration: featuredSession.durationSec,
    })
  }

  const handleQuickSession = (session: QuickSession) => {
    play(`${session.title} Session`, session.category, 300)
  }

  const handleTrendingSession = (session: SessionSummary) => {
    play({
      sessionId: session.status === 'ready' ? session.id : undefined,
      title: session.title,
      category: formatCategory(session.category),
      duration: session.durationSec,
    })
  }

  const handleResumeSession = () => {
    if (unfinishedSession) {
      play(unfinishedSession.sessionTitle, unfinishedSession.category, 600)
    }
  }

  const handleDismissSession = () => {
    setUnfinishedSession(null)
  }

  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-medium tracking-tight mb-8">
        Good {timeOfDay}, {userName}
      </h1>

      {unfinishedSession && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Continue Listening</h2>
          <ContinueListening
            sessionTitle={unfinishedSession.sessionTitle}
            category={unfinishedSession.category}
            categoryColor={unfinishedSession.categoryColor}
            progress={unfinishedSession.progress}
            durationRemaining={unfinishedSession.durationRemaining}
            onResume={handleResumeSession}
            onDismiss={handleDismissSession}
          />
        </div>
      )}

      <div className="mb-8">
        <DailyAffirmation />
      </div>

      <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-primary/20 mb-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5b21b6] via-[#4c1d95] to-[#1e3a8a]" />
        
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/40 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/40 rounded-full blur-3xl" />
        </div>

        <div className="relative p-8 flex flex-col items-center text-center min-h-[400px] justify-between">
          <div className="w-full">
            <div className="inline-block mb-4">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm text-white border border-white/30">
                Sleep & Relaxation
              </span>
            </div>
            
            <h2 className="text-3xl font-serif font-semibold text-white mb-3">
              Tonight's Session
            </h2>
            
            <p className="text-white/90 text-lg mb-2">
              {featuredSession?.title ?? 'Deep Sleep Journey'}
            </p>
            
            <p className="text-white/70 text-sm">
              {featuredSession
                ? `${Math.max(1, Math.round(featuredSession.durationSec / 60))} minutes`
                : '20 minutes'}
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full bg-white/30"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-white/30"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay: 0.5,
                }}
              />
              
              <button
                onClick={handlePlaySession}
                className="relative w-20 h-20 rounded-full bg-white text-primary flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-transform"
              >
                <Play weight="fill" size={32} />
              </button>
            </div>
          </div>

          <div className="h-4" />
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Quick Sessions</h2>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'library' }))}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            See All
            <CaretRight weight="bold" size={16} />
          </button>
        </div>

        <div className="overflow-x-auto -mx-5 px-5 pb-2 snap-x snap-mandatory scrollbar-hide">
          <div className="flex gap-3 w-max">
            {quickSessions.map((session) => {
              const Icon = session.icon
              return (
                <motion.button
                  key={session.id}
                  onClick={() => handleQuickSession(session)}
                  className={`snap-start flex-shrink-0 w-36 p-4 rounded-2xl bg-gradient-to-br ${session.gradient} text-white shadow-lg hover:scale-105 active:scale-95 transition-transform`}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Icon weight="fill" size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-1.5">{session.title}</p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm border border-white/30">
                        {session.duration}
                      </span>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Streak</h2>
        <StreakWidget />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Popular This Week</h2>
          <TrendUp weight="bold" size={20} className="text-primary" />
        </div>

        <div className="overflow-x-auto -mx-5 px-5 pb-2 snap-x snap-mandatory scrollbar-hide">
          <div className="flex gap-4 w-max">
            {(trending ?? popularSessions).map((session) => {
              // Normalise summary / mock shape into one card model.
              const isRemote = 'id' in session && 'durationSec' in session
              const key = session.id
              const title = session.title
              const category = isRemote
                ? formatCategory((session as SessionSummary).category)
                : (session as PopularSession).category
              const playCount = isRemote
                ? String((session as SessionSummary).playCount ?? 0)
                : (session as PopularSession).playCount
              const duration = isRemote
                ? `${Math.max(1, Math.round((session as SessionSummary).durationSec / 60))} min`
                : (session as PopularSession).duration
              const gradient = isRemote
                ? 'from-indigo-600 via-purple-600 to-pink-600'
                : (session as PopularSession).gradient

              return (
                <motion.button
                  key={key}
                  onClick={() =>
                    isRemote
                      ? handleTrendingSession(session as SessionSummary)
                      : play((session as PopularSession).title, (session as PopularSession).category, 600)
                  }
                  className="snap-start flex-shrink-0 w-44 rounded-2xl overflow-hidden bg-card shadow-lg hover:shadow-xl transition-shadow"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="relative">
                    <div className={`h-56 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,_rgba(255,255,255,0.8),_transparent_70%)]" />

                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/30 backdrop-blur-sm text-white border border-white/20">
                          {category}
                        </span>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl">
                          <Play weight="fill" size={24} className="text-primary ml-1" />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 text-left">
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 leading-snug">
                        {title}
                      </h3>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Headphones weight="fill" size={14} />
                          <span className="font-medium">{playCount}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">
                          {duration}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
