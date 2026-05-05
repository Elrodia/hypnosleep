import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Bell, CheckCircle, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { AppNotification } from '@/lib/api-endpoints'

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
  notifications: AppNotification[]
  isLoading: boolean
  isError: boolean
  onMarkAllRead: () => void
  onItemClick: (notif: AppNotification) => void
}

/**
 * Lightweight popover anchored to the header bell. Renders the
 * authenticated user's notifications inbox, pulled from the
 * `/api/notifications` endpoint by the parent component, and lets the
 * user mark items as read individually (by clicking) or in bulk.
 *
 * Closes on outside click and on Escape — both behaviors are wired here
 * rather than on the parent so the Header stays a pure layout shell.
 */
export function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  isLoading,
  isError,
  onMarkAllRead,
  onItemClick,
}: NotificationsPanelProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    // `mousedown` fires before the bell's `onClick`, but the bell stops
    // propagation so the popover's open-toggle still works.
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  const hasUnread = notifications.some((n) => !n.readAt)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -6, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.985 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          className="ls-notifications-panel absolute right-2 top-full mt-2 w-[320px] max-w-[calc(100vw-1rem)] z-50 overflow-hidden rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text)]"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--ls-border)]">
            <h3 className="font-fraunces italic lowercase text-lg leading-none text-[var(--ls-text)]">
              {t('notifications.title')}
            </h3>

            <div className="flex items-center gap-1">
              {hasUnread && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="px-2 py-1 rounded-md text-[11px] lowercase text-[var(--ls-sand)] hover:text-[var(--ls-text)] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                >
                  {t('notifications.markAllRead')}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close notifications"
                className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:bg-[var(--ls-bg)]/60 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
              >
                <X size={14} weight="regular" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[var(--ls-border)]">
            {isLoading && (
              <p className="px-4 py-6 text-sm text-[var(--ls-text-muted)] text-center lowercase">
                {t('notifications.loading')}
              </p>
            )}

            {isError && !isLoading && (
              <p className="px-4 py-6 text-sm text-[var(--ls-text-muted)] text-center lowercase">
                {t('notifications.error')}
              </p>
            )}

            {!isLoading && !isError && notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <CheckCircle
                  size={32}
                  weight="regular"
                  className="mx-auto mb-2 text-[var(--ls-sand-dim)]"
                />
                <p className="text-sm text-[var(--ls-text-muted)] lowercase">
                  {t('notifications.empty')}
                </p>
              </div>
            )}

            {notifications.map((n) => {
              const unread = !n.readAt

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onItemClick(n)}
                  className={`w-full text-left px-4 py-3 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ls-sand-dim)] ${
                    unread
                      ? 'bg-[var(--ls-sand)]/8 hover:bg-[var(--ls-sand)]/12'
                      : 'hover:bg-[var(--ls-bg)]/55 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        unread ? 'bg-[var(--ls-sand)]' : 'bg-transparent'
                      }`}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ls-text)] leading-snug">
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--ls-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-[var(--ls-text-subtle)] mt-1.5 tabular-nums">
                        {formatTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function formatTime(iso: string): string {
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return ''

  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(iso).toLocaleDateString()
}

// Re-export Bell so any future Header refactor can keep a single
// notifications-adjacent import path without changing this component's
// public surface.
export { Bell }
