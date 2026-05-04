import { useState } from 'react'
import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
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

const STYLES = `
.ls-swipe-card {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-sand: #c9b6a3;
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  --ls-danger: #d79a8b;
  font-family: 'Inter', system-ui, sans-serif;
}
`

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
    <div className="ls-swipe-card relative overflow-visible">
      <style>{STYLES}</style>

      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-4"
        style={{
          opacity,
          scale,
        }}
        aria-hidden="true"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ls-danger)]/35 bg-[var(--ls-danger)]/10 text-[var(--ls-danger)]">
          <Trash weight="regular" className="h-6 w-6" />
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
