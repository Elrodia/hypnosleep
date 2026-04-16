import { useEffect, useState } from 'react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useKV } from '@github/spark/hooks'
import { Play, Leaf, Star, Cloud, Eye, Heart, CaretRight } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { StreakWidget } from '@/components/StreakWidget'

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
  icon: typeof Leaf
  gradient: string
}

const quickSessions: QuickSession[] = [
  {
    id: 'calm',
    title: '5-min Calm',
    duration: '5 min',
    icon: Leaf,
    gradient: 'from-purple-600 via-purple-500 to-purple-600',
  },
  {
    id: 'confidence',
    title: '10-min Confidence',
    duration: '10 min',
    icon: Star,
    gradient: 'from-blue-600 via-blue-500 to-blue-600',
  },
  {
    id: 'sleep',
    title: '10-min Sleep',
    duration: '10 min',
    icon: Cloud,
    gradient: 'from-teal-600 via-teal-500 to-teal-600',
  },
  {
    id: 'focus',
    title: '15-min Focus',
    duration: '15 min',
    icon: Eye,
    gradient: 'from-indigo-600 via-indigo-500 to-indigo-600',
  },
  {
    id: 'anxiety',
    title: '5-min Anxiety Relief',
    duration: '5 min',
    icon: Heart,
    gradient: 'from-violet-600 via-violet-500 to-violet-600',
  },
]

export function HomePage() {
  const { play } = useAudioPlayer()
  const [userName] = useKV<string>('user-name', 'Friend')
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay())

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOfDay(getTimeOfDay())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const handlePlaySession = () => {
    play('Deep Sleep Journey - Full Relaxation', 100)
  }

  const handleQuickSession = (session: QuickSession) => {
    play(`${session.title} Session`, 100)
  }

  return (
    <div className="px-5 py-6">
      <h1 className="text-2xl font-medium tracking-tight mb-8">
        Good {timeOfDay}, {userName}
      </h1>

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
              Deep Sleep Journey
            </p>
            
            <p className="text-white/70 text-sm">
              20 minutes
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
          <button className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors font-medium">
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
    </div>
  )
}
