import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Bell, CheckCircle, X } from '@phosphor-icons/react'
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
 * Closes on outside click and on Escape — both behaviours wired here
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.12 }}
          className="absolute right-2 top-full mt-2 w-[320px] max-w-[calc(100vw-1rem)] z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-1">
              {notifications.some((n) => !n.readAt) && (
                <button
                  onClick={onMarkAllRead}
                  className="text-[11px] font-medium text-primary hover:underline px-2 py-1 rounded"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Close notifications"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {isLoading && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
            )}
            {isError && !isLoading && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                Could not load notifications.
              </p>
            )}
            {!isLoading && !isError && notifications.length === 0 && (
              <div className="px-4 py-10 text-center">
                <CheckCircle size={32} weight="duotone" className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">You're all caught up.</p>
              </div>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => onItemClick(n)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                  n.readAt ? 'opacity-70' : 'bg-primary/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.readAt && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
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

// Re-export Bell so the Header file doesn't need to import twice if
// it later wants to render the badge inline.
export { Bell }
