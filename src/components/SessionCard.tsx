import { useState, type MouseEvent, type ReactNode } from 'react'
import { Play, Heart, Waveform } from '@phosphor-icons/react'
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
  onClick?: () => void
  className?: string
  searchQuery?: string
}

const STYLES = `
.ls-session-card {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-session-card .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function SessionCard({
  id,
  title,
  category,
  duration,
  isFavorited = false,
  onPlay,
  onToggleFavorite,
  onClick,
  className,
  searchQuery = '',
}: SessionCardProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [localFavorited, setLocalFavorited] = useState(isFavorited)

  const highlightText = (text: string, query: string): ReactNode => {
    const cleanQuery = query.trim()
    if (!cleanQuery) return text

    const parts = text.split(new RegExp(`(${escapeRegExp(cleanQuery)})`, 'gi'))

    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === cleanQuery.toLowerCase() ? (
            <mark
              key={index}
              className="rounded bg-[var(--ls-sand)]/18 px-0.5 text-[var(--ls-text)]"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          ),
        )}
      </>
    )
  }

  const handleToggleFavorite = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    const newFavoritedState = !localFavorited
    setLocalFavorited(newFavoritedState)
    onToggleFavorite?.(id, newFavoritedState)
  }

  const handlePlay = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onPlay()
  }

  return (
    <motion.div
      className={cn('ls-session-card group', className)}
      animate={{ scale: isPressed ? 0.985 : 1 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
    >
      <style>{STYLES}</style>

      <div
        className="cursor-pointer overflow-hidden rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/65 text-[var(--ls-text)] transition-colors hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/82"
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(event) => {
          if (!onClick) return

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        }}
      >
        <div className="relative flex h-28 items-center justify-center border-b border-[var(--ls-border)] bg-[var(--ls-bg)]/45">
          <motion.div
            animate={{ opacity: [0.22, 0.4, 0.22], scale: [1, 1.04, 1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute h-20 w-20 rounded-full border border-[var(--ls-sand)]/22"
            aria-hidden="true"
          />

          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-sand)]">
            <Waveform size={24} weight="regular" />
          </div>

          <span className="absolute right-2 top-2 rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg)]/80 px-2.5 py-1 text-xs lowercase text-[var(--ls-text-muted)]">
            {duration.toLowerCase()}
          </span>
        </div>

        <div className="space-y-3 p-3">
          <h3 className="min-h-[2.5rem] line-clamp-2 font-fraunces text-base italic lowercase leading-tight text-[var(--ls-text)]">
            {highlightText(title, searchQuery)}
          </h3>

          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex max-w-[55%] items-center rounded-full border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 px-2.5 py-1 text-xs lowercase text-[var(--ls-sand)]">
              <span className="truncate">
                {highlightText(category, searchQuery)}
              </span>
            </span>

            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={handleToggleFavorite}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                whileTap={{ scale: 0.9 }}
                aria-label={localFavorited ? 'remove from favorites' : 'add to favorites'}
                aria-pressed={localFavorited}
              >
                <motion.div
                  animate={{ scale: localFavorited ? [1, 1.18, 1] : 1 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                >
                  <Heart
                    weight={localFavorited ? 'fill' : 'regular'}
                    className={cn(
                      'h-5 w-5 transition-colors duration-200',
                      localFavorited ? 'text-[var(--ls-sand)]' : '',
                    )}
                  />
                </motion.div>
              </motion.button>

              <motion.button
                type="button"
                onClick={handlePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-sand)] bg-[var(--ls-sand)] text-[var(--ls-bg)] transition-colors hover:bg-[var(--ls-sand)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand-dim)]"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                aria-label="play session"
              >
                <Play weight="fill" className="ml-0.5 h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
