import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShareNetwork, Heart, Play, Lock, PencilSimple, Spinner } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  getSession,
  toggleSessionFavorite,
  deleteSession,
  editSessionScript,
  regenerateSessionAudio,
} from '@/lib/api-endpoints'
import { ApiError } from '@/lib/api'
import { ScriptEditorModal } from '@/components/ScriptEditorModal'
import { formatCategory, formatDurationMin, CATEGORY_GRADIENTS } from '@/lib/session-ui'

interface SessionDetailPageProps {
  sessionId: string
  onBack: () => void
  onPlay: () => void
  /**
   * Called after the user confirms deletion. The parent is responsible
   * for removing the session from any cached list state.
   */
  onDeleted?: () => void
}

const categoryTags: Record<string, string> = {
  Sleep: 'bg-indigo-600/90 text-indigo-50',
  Confidence: 'bg-purple-600/90 text-purple-50',
  Fears: 'bg-violet-600/90 text-violet-50',
  Habits: 'bg-blue-600/90 text-blue-50',
  Focus: 'bg-teal-600/90 text-teal-50',
  Anxiety: 'bg-violet-500/90 text-violet-50',
  Custom: 'bg-fuchsia-600/90 text-fuchsia-50',
}

export function SessionDetailPage({ sessionId, onBack, onPlay, onDeleted }: SessionDetailPageProps) {
  const { user } = useAuth()
  const isProUser = user?.plan === 'pro'
  const qc = useQueryClient()
  const [showEditor, setShowEditor] = useState(false)

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
  })

  const favoriteMutation = useMutation({
    mutationFn: () => toggleSessionFavorite(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: () => toast.error('Could not update favorite.'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    onSuccess: () => {
      toast.success('Session deleted')
      qc.invalidateQueries({ queryKey: ['sessions'] })
      onDeleted?.()
      setTimeout(onBack, 200)
    },
    onError: () => toast.error('Could not delete session.'),
  })

  const editMutation = useMutation({
    mutationFn: (scriptText: string) => editSessionScript(sessionId, scriptText),
    onSuccess: () => {
      toast.success('Script saved')
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        toast.error('Script editing is a Pro feature.')
      } else {
        toast.error('Could not save script.')
      }
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateSessionAudio(sessionId),
    onSuccess: () => {
      toast.success('Regenerating audio…')
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        toast.error('Regeneration is a Pro feature.')
      } else {
        toast.error('Could not regenerate.')
      }
    },
  })

  const handleShare = async () => {
    if (!session) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: session.title,
          text: `Check out this hypnosis session: ${session.title}`,
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') toast.error('Failed to share')
      }
    } else {
      toast.success('Link copied to clipboard!')
    }
  }

  const handleDelete = () => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    deleteMutation.mutate()
  }

  const handleUnlockPro = () => {
    window.dispatchEvent(new CustomEvent('show-subscription'))
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Spinner size={40} className="text-primary animate-spin" />
      </div>
    )
  }

  if (isError || !session) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground text-center">Couldn't load this session.</p>
        <Button onClick={onBack}>Go back</Button>
      </div>
    )
  }

  const category = formatCategory(session.category)
  const gradient = CATEGORY_GRADIENTS[category] ?? 'from-purple-600 to-indigo-600'
  const scriptText = session.scriptText ?? ''
  const scriptLines = scriptText.split('\n').filter((line) => line.trim())
  const previewLines = scriptLines.slice(0, 3)
  const remainingLines = scriptLines.slice(3)

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-background overflow-hidden"
    >
      <div className="h-full overflow-y-auto pb-32">
        <div className={cn('relative h-64 bg-gradient-to-br', gradient)}>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-3xl" />
          </div>

          <div className="relative h-full flex flex-col">
            <div className="flex items-center justify-between p-4">
              <motion.button
                onClick={onBack}
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                whileTap={{ scale: 0.95 }}
              >
                <ArrowLeft weight="bold" size={20} />
              </motion.button>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={handleShare}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20"
                  whileTap={{ scale: 0.95 }}
                >
                  <ShareNetwork weight="bold" size={20} />
                </motion.button>

                <motion.button
                  onClick={() => favoriteMutation.mutate()}
                  disabled={favoriteMutation.isPending}
                  className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20 disabled:opacity-60"
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart
                    weight={session.favorited ? 'fill' : 'bold'}
                    size={20}
                    className={session.favorited ? 'text-red-400' : ''}
                  />
                </motion.button>
              </div>
            </div>

            <div className="flex-1" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>

        <div className="px-5 -mt-8 relative z-10">
          <div className="bg-card rounded-3xl shadow-2xl p-6 border border-border/50">
            <h1 className="text-3xl font-serif font-semibold mb-4 leading-tight">{session.title}</h1>

            <div className="flex items-center gap-3 mb-2">
              <span
                className={cn(
                  'inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-full',
                  categoryTags[category] || 'bg-slate-600/90 text-slate-50',
                )}
              >
                {category}
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                {formatDurationMin(session.durationSec)}
              </span>
              {session.status !== 'ready' && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Spinner className="animate-spin" size={12} />
                  {session.status}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">Created {formattedDate}</p>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between px-1 mb-4">
              <h2 className="text-lg font-semibold">Script Preview</h2>
              {isProUser && scriptText && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditor(true)}
                  className="gap-2"
                >
                  <PencilSimple size={16} />
                  Edit
                </Button>
              )}
            </div>

            <div className="bg-card rounded-2xl p-5 border border-border relative overflow-hidden">
              {scriptText ? (
                <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
                  {previewLines.map((line, index) => (
                    <p
                      key={index}
                      className="first-letter:text-primary first-letter:text-lg first-letter:font-semibold"
                    >
                      {line}
                    </p>
                  ))}

                  <div className="relative">
                    <div className="space-y-4 blur-sm select-none pointer-events-none">
                      {remainingLines.slice(0, 4).map((line, index) => (
                        <p key={index} className="text-muted-foreground/60">
                          {line}
                        </p>
                      ))}
                    </div>

                    {!isProUser && remainingLines.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-card via-card/95 to-transparent"
                      >
                        <div className="text-center px-4 py-8">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Lock weight="fill" size={32} className="text-primary" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Unlock Full Script</h3>
                          <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                            Upgrade to Pro to read the complete hypnosis script and access advanced features
                          </p>
                          <Button
                            onClick={handleUnlockPro}
                            className="gap-2 bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_100%] animate-shimmer"
                          >
                            <Lock weight="fill" size={16} />
                            Unlock with Pro
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {isProUser && (
                      <div className="space-y-4 mt-4">
                        {remainingLines.slice(4).map((line, index) => (
                          <p key={index} className="text-sm leading-relaxed text-foreground/90">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Script is not yet available for this session.
                </p>
              )}
            </div>
          </div>

          {isProUser && (
            <div className="mt-6">
              <Button
                variant="outline"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending || session.status === 'generating'}
                className="w-full gap-2"
              >
                {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate Audio'}
              </Button>
            </div>
          )}

          <div className="mt-8 pb-4">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="w-full text-center py-3 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Session'}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent border-t border-border/50 backdrop-blur-xl z-20">
        <Button
          onClick={onPlay}
          size="lg"
          disabled={session.status !== 'ready'}
          className="w-full h-14 text-lg font-semibold gap-3 shadow-lg shadow-primary/20"
        >
          <Play weight="fill" size={24} />
          {session.status === 'ready' ? 'Play Session' : 'Preparing audio…'}
        </Button>
      </div>

      <AnimatePresence>
        {showEditor && (
          <ScriptEditorModal
            isOpen={showEditor}
            onClose={() => setShowEditor(false)}
            initialScript={scriptText}
            sessionId={sessionId}
            onSave={(edited) => {
              editMutation.mutate(edited)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
