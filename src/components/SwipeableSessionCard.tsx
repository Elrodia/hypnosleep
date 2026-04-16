import { useState } from 'react'
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion'
import { Trash } from '@phosphor-icons/react'
import { SessionCard } from './SessionCard'

interface SwipeableSessionCardProps {
  id: string
  title: string
  category: string
  duration: string
  gradient: string
  isFavorited?: boolean
  onPlay: () => void
  onToggleFavorite?: (id: string, isFavorited: boolean) => void
  onRemove: (id: string) => void
  onClick?: () => void
  searchQuery?: string
}

const SWIPE_THRESHOLD = -80

export function SwipeableSessionCard({
  id,
  title,
  category,
  duration,
  gradient,
  isFavorited = false,
  onPlay,
  onToggleFavorite,
  onRemove,
  onClick,
  searchQuery = '',
}: SwipeableSessionCardProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const x = useMotionValue(0)
  const opacity = useTransform(x, [SWIPE_THRESHOLD, 0], [1, 0])
  const scale = useTransform(x, [SWIPE_THRESHOLD, 0], [1, 0.8])

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      setIsRemoving(true)
      setTimeout(() => {
        onRemove(id)
      }, 300)
    } else {
      x.set(0)
    }
  }

  return (
    <div className="relative overflow-visible">
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4"
        style={{
          opacity,
          scale,
        }}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive text-destructive-foreground">
          <Trash weight="fill" className="w-6 h-6" />
        </div>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={isRemoving ? { x: -400, opacity: 0 } : {}}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        className="relative z-10"
      >
        <SessionCard
          id={id}
          title={title}
          category={category}
          duration={duration}
          gradient={gradient}
          isFavorited={isFavorited}
          onPlay={onPlay}
          onToggleFavorite={onToggleFavorite}
          onClick={onClick}
          searchQuery={searchQuery}
        />
      </motion.div>
    </div>
  )
}
