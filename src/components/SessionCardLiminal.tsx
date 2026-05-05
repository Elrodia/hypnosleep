import { Heart, Play } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

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
.ls-card {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  position: relative;
  width: 100%;
  padding: 18px;
  background: color-mix(in srgb, var(--ls-bg-elevated) 68%, transparent);
  border: 1px solid var(--ls-border-strong);
  border-radius: 6px;
  cursor: pointer;
  transition:
    border-color 220ms ease,
    background 220ms ease,
    transform 150ms ease;
  text-align: left;
  display: block;
  color: var(--ls-text);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-card:hover {
  border-color: var(--ls-sand-dim);
  background: color-mix(in srgb, var(--ls-bg-elevated) 82%, transparent);
}
.ls-card:active {
  transform: scale(0.99);
}
.ls-card:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--ls-sand-dim);
}
.ls-card__title {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  font-style: italic;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
  line-height: 1.25;
  text-transform: lowercase;
  color: var(--ls-text);
  margin: 0;
}
.ls-card__meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: var(--ls-text-muted);
  margin-top: 8px;
}
.ls-card__row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.ls-card__heart,
.ls-card__play {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 180ms ease,
    background 180ms ease,
    color 180ms ease,
    transform 150ms ease;
}
.ls-card__heart {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ls-text-muted);
}
.ls-card__heart:hover {
  border-color: var(--ls-border-strong);
  color: var(--ls-text);
}
.ls-card__heart[data-active="true"] {
  color: var(--ls-sand);
}
.ls-card__heart:active {
  transform: scale(0.92);
}
.ls-card__heart:focus-visible,
.ls-card__play:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--ls-sand-dim);
}
.ls-card__play {
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  border: 1px solid var(--ls-sand);
  background: transparent;
  color: var(--ls-sand);
}
.ls-card__play:hover {
  background: color-mix(in srgb, var(--ls-sand) 10%, transparent);
}
.ls-card__play:active {
  transform: scale(0.95);
}
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

function formatMin(sec: number): number {
  return Math.max(1, Math.round(sec / 60))
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
  const { t } = useTranslation()
  const stop = (event: MouseEvent) => {
    event.stopPropagation()
  }

  const handleHeart = (event: MouseEvent) => {
    stop(event)
    onToggleFavorite()
  }

  const handlePlay = (event: MouseEvent) => {
    stop(event)
    onPlay()
  }

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick()
        }
      }}
      className="ls-card"
      whileTap={{ scale: 0.99 }}
    >
      <style>{STYLES}</style>

      <h3 className="ls-card__title">{title.toLowerCase()}</h3>

      <p className="ls-card__meta">
        {category.toLowerCase()} · {t('sessionCard.minutes', { count: formatMin(durationSec) })} · {formatRelativeDate(createdAt)}
      </p>

      <div className="ls-card__row">
        <button
          type="button"
          aria-label={isFavorited ? t('library.actionUnfavorite') : t('library.actionFavorite')}
          aria-pressed={isFavorited}
          data-active={isFavorited ? 'true' : 'false'}
          className="ls-card__heart"
          onClick={handleHeart}
        >
          <Heart size={20} weight={isFavorited ? 'fill' : 'regular'} />
        </button>

        <button
          type="button"
          aria-label={t('sessionCard.ariaPlay', { title })}
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
