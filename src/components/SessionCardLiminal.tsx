import { Heart, Play } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { MouseEvent } from 'react'

export interface SessionCardLiminalProps {
  id: string
  title: string
  category: string
  durationSec: number
  createdAt: string | Date
  isFavorited: boolean
  onPlay: () => void
  onToggleFavorite: () => void
  onClick?: () => void
}

const STYLES = `
.ls-card{position:relative;width:100%;padding:20px;background:var(--ls-bg-card);border:1px solid var(--ls-fg-faint);border-radius:14px;margin-bottom:12px;cursor:pointer;transition:border-color 250ms ease,box-shadow 350ms ease,transform 150ms ease;text-align:left;display:block;}
.ls-card:hover{border-color:var(--ls-fg-muted);box-shadow:0 6px 24px var(--ls-glow);}
.ls-card:active{transform:scale(0.99);}
.ls-card__title{font-family:'Inter',system-ui,sans-serif;font-weight:500;font-size:0.95rem;letter-spacing:0;line-height:1.35;text-transform:lowercase;color:var(--ls-fg-primary);margin:0;}
.ls-card__meta{font-family:'Inter',system-ui,sans-serif;font-weight:400;font-size:0.75rem;letter-spacing:0.05em;text-transform:lowercase;color:var(--ls-fg-muted);margin-top:8px;}
.ls-card__row{display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:18px;}
.ls-card__heart{background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:6px;color:var(--ls-fg-muted);transition:color 200ms ease,transform 150ms ease;}
.ls-card__heart[data-active="true"]{color:var(--ls-accent);}
.ls-card__heart:active{transform:scale(0.92);}
.ls-card__play{width:36px;height:36px;border-radius:9999px;border:1px solid var(--ls-accent);background:transparent;color:var(--ls-accent);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 220ms ease,color 220ms ease,transform 150ms ease;}
.ls-card__play:hover{background:var(--ls-accent);color:var(--ls-bg-base);}
.ls-card__play:active{transform:scale(0.95);}
`

function formatRelativeDate(input: string | Date): string {
  const then = typeof input === 'string' ? new Date(input) : input
  const ms = Date.now() - then.getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'today'
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(ms / day)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return '1 week ago'
  return `${weeks} weeks ago`
}

function formatMin(sec: number): string {
  return `${Math.max(1, Math.round(sec / 60))} min`
}

export function SessionCardLiminal({
  title,
  category,
  durationSec,
  createdAt,
  isFavorited,
  onPlay,
  onToggleFavorite,
  onClick,
}: SessionCardLiminalProps) {
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
  }

  const handleHeart = (e: MouseEvent) => {
    stop(e)
    onToggleFavorite()
  }

  const handlePlay = (e: MouseEvent) => {
    stop(e)
    onPlay()
  }

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className="ls-card"
      whileTap={{ scale: 0.99 }}
    >
      <style>{STYLES}</style>
      <h3 className="ls-card__title">{title.toLowerCase()}</h3>
      <p className="ls-card__meta">
        {category.toLowerCase()} · {formatMin(durationSec)} · {formatRelativeDate(createdAt)}
      </p>
      <div className="ls-card__row">
        <button
          type="button"
          aria-label={isFavorited ? 'remove from favorites' : 'add to favorites'}
          aria-pressed={isFavorited}
          data-active={isFavorited ? 'true' : 'false'}
          className="ls-card__heart"
          onClick={handleHeart}
        >
          <Heart size={20} weight={isFavorited ? 'fill' : 'regular'} />
        </button>
        <button
          type="button"
          aria-label="play session"
          className="ls-card__play"
          onClick={handlePlay}
        >
          <Play size={16} weight="fill" />
        </button>
      </div>
    </motion.div>
  )
}

export default SessionCardLiminal
