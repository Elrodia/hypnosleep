import { useState } from 'react'
import { ClockCounterClockwise, DotsThree, Play, PencilSimple, ArrowsClockwise, Trash } from '@phosphor-icons/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface RecentCreation {
  id: string
  title: string
  date: string
  duration: string
  status: 'Completed' | 'Draft'
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

export function RecentCreations({ sessions, onPlay, onEdit, onRegenerate, onDelete }: RecentCreationsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const recentSessions = sessions.slice(0, 5).map(session => {
    const date = new Date(session.createdAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    let dateStr = ''
    if (diffMins < 1) {
      dateStr = 'Just now'
    } else if (diffMins < 60) {
      dateStr = `${diffMins}m ago`
    } else if (diffHours < 24) {
      dateStr = `${diffHours}h ago`
    } else if (diffDays === 1) {
      dateStr = 'Yesterday'
    } else if (diffDays < 7) {
      dateStr = `${diffDays}d ago`
    } else {
      dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    return {
      id: session.id,
      title: session.title,
      date: dateStr,
      duration: session.duration,
      status: (session.playCount ?? 0) > 0 ? 'Completed' : 'Draft' as const
    }
  })

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setTimeout(() => {
      onDelete(id)
      setDeletingId(null)
    }, 300)
  }

  if (recentSessions.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <ClockCounterClockwise size={20} weight="duotone" className="text-primary" />
          <h3 className="text-sm font-medium text-foreground">Recent Creations</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 px-6 rounded-xl bg-card/30 border border-dashed border-border">
          <ClockCounterClockwise size={48} weight="thin" className="text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground text-center">
            Your created sessions will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-6 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <ClockCounterClockwise size={20} weight="duotone" className="text-primary" />
        <h3 className="text-sm font-medium text-foreground">Recent Creations</h3>
      </div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {recentSessions.map((session) => (
            <motion.div
              key={session.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100, height: 0, marginBottom: -8 }}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-3 p-4 rounded-lg bg-card/50 border border-border hover:bg-card hover:border-primary/30 transition-all group ${
                deletingId === session.id ? 'opacity-50' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {session.title}
                  </h4>
                  <Badge
                    variant={session.status === 'Completed' ? 'default' : 'secondary'}
                    className={`text-[10px] px-1.5 py-0 h-5 shrink-0 ${
                      session.status === 'Completed'
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {session.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{session.date}</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span>{session.duration}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label="More options"
                  >
                    <DotsThree size={20} weight="bold" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onPlay(session.id)} className="gap-2">
                    <Play size={16} weight="fill" />
                    <span>Play</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(session.id)} className="gap-2">
                    <PencilSimple size={16} weight="regular" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRegenerate(session.id)} className="gap-2">
                    <ArrowsClockwise size={16} weight="regular" />
                    <span>Regenerate Audio</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(session.id)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash size={16} weight="regular" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
