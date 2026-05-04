import { useState } from 'react'
import {
  ClockCounterClockwise,
  DotsThree,
  Play,
  PencilSimple,
  ArrowsClockwise,
  Trash,
} from '@phosphor-icons/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion, AnimatePresence } from 'framer-motion'

interface RecentCreation {
  id: string
  title: string
  date: string
  duration: string
  status: 'completed' | 'draft'
}

interface RecentCreationsProps {
  sessions: Array<{
    id: string
    title: string
    duration: string
    createdAt: number
    playCount?: number
  }>
  onPlay: (id: string) => void
  onEdit: (id: string) => void
  onRegenerate: (id: string) => void
  onDelete: (id: string) => void
}

const STYLES = `
.ls-recent-creations {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  --ls-danger: #d79a8b;
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-recent-creations .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

const menuItemClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm lowercase text-[var(--ls-text-muted)] outline-none transition-colors hover:bg-[var(--ls-sand)]/8 hover:text-[var(--ls-text)] focus:bg-[var(--ls-sand)]/8 focus:text-[var(--ls-text)]'

const deleteItemClass =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm lowercase text-[var(--ls-danger)] outline-none transition-colors hover:bg-[var(--ls-danger)]/8 focus:bg-[var(--ls-danger)]/8'

function formatRelativeDate(createdAt: number): string {
  const date = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (!Number.isFinite(diffMs) || diffMs < 0) return 'today'
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toLowerCase()
}

export function RecentCreations({
  sessions,
  onPlay,
  onEdit,
  onRegenerate,
  onDelete,
}: RecentCreationsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const recentSessions: RecentCreation[] = sessions.slice(0, 5).map((session) => ({
    id: session.id,
    title: session.title,
    date: formatRelativeDate(session.createdAt),
    duration: session.duration,
    status: (session.playCount ?? 0) > 0 ? 'completed' : 'draft',
  }))

  const handleDelete = (id: string) => {
    setDeletingId(id)

    setTimeout(() => {
      onDelete(id)
      setDeletingId(null)
    }, 300)
  }

  if (recentSessions.length === 0) {
    return (
      <section className="ls-recent-creations w-full max-w-2xl mx-auto px-6 pb-6">
        <style>{STYLES}</style>

        <div className="mb-4 flex items-center gap-2">
          <ClockCounterClockwise
            size={20}
            weight="regular"
            className="text-[var(--ls-sand)]"
          />
          <h3 className="font-fraunces text-lg italic lowercase text-[var(--ls-text)]">
            recent creations
          </h3>
        </div>

        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/35 px-6 py-12">
          <ClockCounterClockwise
            size={44}
            weight="thin"
            className="mb-3 text-[var(--ls-text-subtle)]"
          />
          <p className="text-center text-sm lowercase text-[var(--ls-text-muted)]">
            your created sessions will appear here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="ls-recent-creations w-full max-w-2xl mx-auto px-6 pb-6">
      <style>{STYLES}</style>

      <div className="mb-4 flex items-center gap-2">
        <ClockCounterClockwise
          size={20}
          weight="regular"
          className="text-[var(--ls-sand)]"
        />
        <h3 className="font-fraunces text-lg italic lowercase text-[var(--ls-text)]">
          recent creations
        </h3>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {recentSessions.map((session) => (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -80, height: 0, marginBottom: -8 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className={`group flex items-center gap-3 rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)]/45 p-4 transition-colors hover:border-[var(--ls-border-strong)] hover:bg-[var(--ls-bg-elevated)]/70 ${
                deletingId === session.id ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="truncate text-sm font-medium lowercase text-[var(--ls-text)]">
                    {session.title}
                  </h4>

                  <span
                    className={`h-5 shrink-0 rounded-full border px-2 text-[10px] lowercase leading-5 ${
                      session.status === 'completed'
                        ? 'border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8 text-[var(--ls-sand)]'
                        : 'border-[var(--ls-border)] bg-[var(--ls-bg)]/35 text-[var(--ls-text-muted)]'
                    }`}
                  >
                    {session.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs lowercase text-[var(--ls-text-muted)]">
                  <span>{session.date}</span>
                  <span className="h-1 w-1 rounded-full bg-[var(--ls-border-strong)]" />
                  <span>{session.duration}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-[var(--ls-text-muted)] opacity-100 transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]"
                    aria-label="more options"
                  >
                    <DotsThree size={20} weight="bold" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] p-1 text-[var(--ls-text)] shadow-none"
                >
                  <DropdownMenuItem
                    onClick={() => onPlay(session.id)}
                    className={menuItemClass}
                  >
                    <Play size={16} weight="fill" />
                    <span>play</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => onEdit(session.id)}
                    className={menuItemClass}
                  >
                    <PencilSimple size={16} weight="regular" />
                    <span>edit</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => onRegenerate(session.id)}
                    className={menuItemClass}
                  >
                    <ArrowsClockwise size={16} weight="regular" />
                    <span>regenerate audio</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleDelete(session.id)}
                    className={deleteItemClass}
                  >
                    <Trash size={16} weight="regular" />
                    <span>delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
