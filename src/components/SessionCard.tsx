import { useState } from 'react'
import { Play, Heart } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SessionCardProps {
  id: string
  title: string
  category: string
  duration: string
  gradient: string
  isFavorited?: boolean
  onPlay: () => void
  onToggleFavorite?: (id: string, isFavorited: boolean) => void
  className?: string
}

const categoryColors: Record<string, string> = {
  Sleep: 'bg-indigo-600/90 text-indigo-50',
  Confidence: 'bg-purple-600/90 text-purple-50',
  Fears: 'bg-violet-600/90 text-violet-50',
  Habits: 'bg-blue-600/90 text-blue-50',
  Focus: 'bg-teal-600/90 text-teal-50',
  Custom: 'bg-fuchsia-600/90 text-fuchsia-50',
  All: 'bg-slate-600/90 text-slate-50',
}

export function SessionCard({
  id,
  title,
  category,
  duration,
  gradient,
  isFavorited = false,
  onPlay,
  onToggleFavorite,
  className,
}: SessionCardProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [localFavorited, setLocalFavorited] = useState(isFavorited)

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newFavoritedState = !localFavorited
    setLocalFavorited(newFavoritedState)
    onToggleFavorite?.(id, newFavoritedState)
  }

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPlay()
  }

  return (
    <motion.div
      className={cn('group', className)}
      animate={{
        scale: isPressed ? 0.95 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
    >
      <div className="bg-card rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
        <div
          className={cn(
            'relative h-32 bg-gradient-to-br flex items-center justify-center',
            gradient
          )}
        >
          <span className="absolute top-2 right-2 text-xs font-medium px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white">
            {duration}
          </span>
        </div>

        <div className="p-3 space-y-3">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
            {title}
          </h3>

          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full',
                categoryColors[category] || categoryColors.All
              )}
            >
              {category}
            </span>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleToggleFavorite}
                className="p-1.5 hover:bg-muted/50 rounded-full transition-colors"
                whileTap={{ scale: 0.9 }}
                aria-label={localFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <motion.div
                  animate={{
                    scale: localFavorited ? [1, 1.3, 1] : 1,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: 'easeOut',
                  }}
                >
                  <Heart
                    weight={localFavorited ? 'fill' : 'regular'}
                    className={cn(
                      'w-5 h-5 transition-colors duration-200',
                      localFavorited ? 'text-red-500' : 'text-muted-foreground'
                    )}
                  />
                </motion.div>
              </motion.button>

              <motion.button
                onClick={handlePlay}
                className="w-9 h-9 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors shadow-md hover:shadow-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Play session"
              >
                <Play weight="fill" className="w-4 h-4 text-primary-foreground ml-0.5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
