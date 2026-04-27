import { useState, useCallback } from 'react'
import { Bell } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth-context'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/lib/api-endpoints'
import { Logo } from './Logo'
import { NotificationsPanel } from './NotificationsPanel'

/**
 * App header with the in-app notifications bell.
 *
 * The bell badge reflects the count of unread notifications returned
 * from `/api/notifications`. Clicking it opens the
 * {@link NotificationsPanel} popover. Items can be marked read
 * individually (by clicking) or in bulk; both mutations invalidate
 * the React-Query cache so the badge updates immediately.
 *
 * When the user is unauthenticated we render the bell as a
 * non-interactive icon — calling the API would 401 and there's
 * nothing meaningful to show.
 */
export function Header() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => listNotifications(),
    enabled: Boolean(user),
    // Poll occasionally so a session_ready notification fired by the
    // worker shows up without the user having to refresh.
    refetchInterval: 60_000,
  })
  const notifications: AppNotification[] = data ?? []
  const unread = notifications.filter((n) => !n.readAt).length

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const handleItemClick = useCallback(
    (n: AppNotification) => {
      if (!n.readAt) markRead.mutate(n.id)
      // If the notification carries a deep-link, surface it via the
      // app's navigation event so the appropriate tab activates.
      if (n.url && n.url.startsWith('/library')) {
        window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'library' }))
      } else if (n.url && n.url.startsWith('/profile')) {
        window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'profile' }))
      }
      setOpen(false)
    },
    [markRead],
  )

  return (
    <header className="fixed top-0 left-0 right-0 h-14 border-b border-border/50 bg-card/30 backdrop-blur-xl z-50">
      <div className="flex items-center justify-between h-full px-4 relative">
        <div className="flex items-center gap-2">
          <Logo variant="mark" size={28} className="rounded-md" alt="" />
          <h1 className="text-xl font-serif tracking-wide text-foreground">
            HypnoSleep
          </h1>
        </div>

        <button
          onClick={(e) => {
            // Stop propagation so the panel's outside-click handler
            // doesn't immediately close the popover we just opened.
            e.stopPropagation()
            if (user) setOpen((v) => !v)
          }}
          className="relative p-2 -mr-2 transition-colors hover:text-primary"
          aria-label={user ? `Notifications${unread > 0 ? ` (${unread} unread)` : ''}` : 'Notifications'}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell size={24} weight="regular" className="text-foreground" />
          {user && unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border border-card"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </button>

        {user && (
          <NotificationsPanel
            isOpen={open}
            onClose={() => setOpen(false)}
            notifications={notifications}
            isLoading={isLoading}
            isError={isError}
            onMarkAllRead={() => markAllRead.mutate()}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </header>
  )
}
