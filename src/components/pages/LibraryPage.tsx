import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { Button } from '@/components/ui/button'
import { PlusCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { SessionCard } from '@/components/SessionCard'

type FilterCategory = 'All' | 'Sleep' | 'Confidence' | 'Fears' | 'Habits' | 'Focus' | 'Custom'

interface LibrarySession {
  id: string
  title: string
  category: FilterCategory
  duration: string
  gradient: string
  playCount: number
  createdAt: number
  isFavorited?: boolean
}

const filterCategories: FilterCategory[] = ['All', 'Sleep', 'Confidence', 'Fears', 'Habits', 'Focus', 'Custom']

export function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')
  const [sessions, setSessions] = useKV<LibrarySession[]>('library-sessions', [])
  const { play } = useAudioPlayer()

  const filteredSessions = activeFilter === 'All' 
    ? (sessions || [])
    : (sessions || []).filter(session => session.category === activeFilter)

  const handlePlaySession = (session: LibrarySession) => {
    play(session.title, 100)
  }

  const handleToggleFavorite = (id: string, isFavorited: boolean) => {
    setSessions((currentSessions) =>
      (currentSessions || []).map((session) =>
        session.id === id ? { ...session, isFavorited } : session
      )
    )
  }

  return (
    <div className="p-4 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Library</h1>
      
      <div className="mb-6 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {filterCategories.map((category) => {
            const isActive = activeFilter === category
            return (
              <button
                key={category}
                onClick={() => setActiveFilter(category)}
                className={`
                  flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                    : 'bg-transparent border border-border text-foreground hover:border-primary/50'
                  }
                `}
              >
                {category}
              </button>
            )
          })}
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-16 px-4"
        >
          <div className="mb-6 text-8xl opacity-20">
            📚
          </div>
          <h2 className="text-xl font-semibold mb-2 text-center">No sessions yet</h2>
          <p className="text-muted-foreground text-center mb-8 max-w-sm">
            Create your first session and start your journey to better sleep and self-improvement.
          </p>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => {
              const event = new CustomEvent('navigate-to-tab', { detail: 'create' })
              window.dispatchEvent(event)
            }}
          >
            <PlusCircle weight="fill" className="w-5 h-5" />
            Create Your First Session
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filteredSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <SessionCard
                id={session.id}
                title={session.title}
                category={session.category}
                duration={session.duration}
                gradient={session.gradient}
                isFavorited={session.isFavorited}
                onPlay={() => handlePlaySession(session)}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
