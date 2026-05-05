import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ShareNetwork,
  Heart,
  Play,
  Lock,
  PencilSimple,
  Spinner,
  Trash,
  Clock,
  Waveform,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
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
import { formatCategory, formatDurationMin } from '@/lib/session-ui'

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

const STYLES = `
.ls-session-detail {
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
.ls-session-detail .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function SessionDetailPage({
  sessionId,
  onBack,
  onPlay,
  onDeleted,
}: SessionDetailPageProps) {
  const { t } = useTranslation()
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
    onError: () => toast.error(t('library.favoriteError')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(sessionId),
    onSuccess: () => {
      toast.success(t('library.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['sessions'] })
      onDeleted?.()
      setTimeout(onBack, 200)
    },
    onError: () => toast.error(t('library.deleteError')),
  })

  const editMutation = useMutation({
    mutationFn: (scriptText: string) => editSessionScript(sessionId, scriptText),
    onSuccess: () => {
      toast.success(t('sessionDetail.toastScriptSaved'))
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        toast.error(t('sessionDetail.toastScriptPro'))
      } else {
        toast.error(t('sessionDetail.toastScriptError'))
      }
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateSessionAudio(sessionId),
    onSuccess: () => {
      toast.success(t('sessionDetail.toastRegenStarted'))
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 402) {
        toast.error(t('sessionDetail.toastRegenPro'))
      } else {
        toast.error(t('sessionDetail.toastRegenError'))
      }
    },
  })

  const handleShare = async () => {
    if (!session) return

    const url = `${window.location.origin}/?session=${encodeURIComponent(session.id)}`
    const payload = {
      title: session.title,
      text: `Check out this hypnosis session: ${session.title}`,
      url,
    }

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share(payload)
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // Fall through to clipboard fallback below.
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('sessionDetail.toastLinkCopied'))
    } catch {
      toast.error(t('sessionDetail.toastLinkError'))
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t('sessionDetail.deleteConfirm'))) return
    deleteMutation.mutate()
  }

  const handleUnlockPro = () => {
    // Switch to the profile tab first so the ProUpgradePage (mounted
    // inside ProfilePage) is actually rendered when the
    // `show-subscription` listener fires. Without this, the event is
    // dispatched but no listener is mounted because the user is on a
    // different tab.
    window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'profile' }))
    // Defer the subscription event by a tick so the profile tab has
    // mounted its event listener before we fire.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('show-subscription'))
    }, 50)
  }

  if (isLoading) {
    return (
      <div className="ls-session-detail fixed inset-0 z-50 flex items-center justify-center bg-[var(--ls-bg)] text-[var(--ls-text)]">
        <style>{STYLES}</style>
        <Spinner size={32} className="animate-spin text-[var(--ls-sand)]" />
      </div>
    )
  }

  if (isError || !session) {
    return (
      <div className="ls-session-detail fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--ls-bg)] p-6 text-[var(--ls-text)]">
        <style>{STYLES}</style>
        <p className="text-center text-sm text-[var(--ls-text-muted)]">
          couldn't load this session.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] px-5 py-2 text-sm lowercase text-[var(--ls-text)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-sand)]"
        >
          go back
        </button>
      </div>
    )
  }

  const category = formatCategory(session.category)
  const scriptText = session.scriptText ?? ''
  const scriptLines = scriptText.split('\n').map((l) => l.trim()).filter(Boolean)
  const previewLines = scriptLines.slice(0, 3)
  const lockedPreviewLines = scriptLines.slice(3, 7)
  const proRemainingLines = scriptLines.slice(3)

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const statusLabel =
    session.status === 'ready'
      ? 'ready'
      : session.status === 'generating'
      ? 'preparing'
      : session.status

  const isReady = session.status === 'ready'
  const hasLockedScript = !isProUser && proRemainingLines.length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="ls-session-detail fixed inset-0 z-50 overflow-hidden bg-[var(--ls-bg)] text-[var(--ls-text)]"
    >
      <style>{STYLES}</style>

      <div className="h-full overflow-y-auto pb-32">
        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-[var(--ls-bg)] border-b border-[var(--ls-border)]">
          <div className="flex items-center justify-between h-14 px-5">
            <button
              type="button"
              onClick={onBack}
              aria-label={t('sessionDetail.ariaBack')}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)]"
            >
              <ArrowLeft size={18} weight="regular" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                aria-label={t('sessionDetail.shareCta')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)]"
              >
                <ShareNetwork size={18} weight="regular" />
              </button>

              <button
                type="button"
                onClick={() => favoriteMutation.mutate()}
                disabled={favoriteMutation.isPending}
                aria-label={session.favorited ? t('sessionDetail.unfavoriteCta') : t('sessionDetail.favoriteCta')}
                aria-pressed={session.favorited}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-border-strong)] hover:text-[var(--ls-text)] disabled:opacity-60"
              >
                <Heart
                  size={18}
                  weight={session.favorited ? 'fill' : 'regular'}
                  className={session.favorited ? 'text-[var(--ls-sand)]' : ''}
                />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-xl px-6 pt-10 space-y-8">
          {/* Title block */}
          <section className="space-y-5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--ls-text-subtle)]">
              <span>session</span>
              <span aria-hidden="true">·</span>
              <span>{statusLabel}</span>
              {!isReady && (
                <Spinner
                  size={11}
                  className="animate-spin text-[var(--ls-text-subtle)]"
                />
              )}
            </div>

            <h1 className="font-fraunces italic lowercase text-4xl leading-tight text-[var(--ls-text)]">
              {session.title.toLowerCase()}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--ls-text-muted)]">
              <span className="inline-flex items-center rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] px-3 py-1 text-[11px] lowercase tracking-wide text-[var(--ls-sand)]">
                {category.toLowerCase()}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} weight="regular" />
                {formatDurationMin(session.durationSec)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Waveform size={13} weight="regular" />
                {formattedDate.toLowerCase()}
              </span>
            </div>
          </section>

          {/* Script preview card */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--ls-text-subtle)]">
                {t('sessionDetail.scriptHeader')}
              </h2>
              {isProUser && scriptText && (
                <button
                  type="button"
                  onClick={() => setShowEditor(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] px-3 py-1.5 text-xs lowercase text-[var(--ls-text-muted)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-sand)]"
                >
                  <PencilSimple size={13} weight="regular" />
                  edit
                </button>
              )}
            </div>

            <div className="relative overflow-hidden rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]/70 p-6">
              {scriptText ? (
                <div className="space-y-4 text-sm leading-relaxed text-[var(--ls-text)]">
                  {previewLines.map((line, index) => (
                    <p
                      key={`p-${index}`}
                      className="first-letter:text-[var(--ls-sand)] first-letter:text-lg first-letter:font-medium"
                    >
                      {line}
                    </p>
                  ))}

                  {isProUser && proRemainingLines.length > 0 && (
                    <div className="space-y-4">
                      {proRemainingLines.map((line, index) => (
                        <p
                          key={`pro-${index}`}
                          className="text-sm leading-relaxed text-[var(--ls-text)]"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )}

                  {hasLockedScript && (
                    <div className="relative">
                      <div
                        aria-hidden="true"
                        className="space-y-4 select-none pointer-events-none opacity-30"
                      >
                        {lockedPreviewLines.map((line, index) => (
                          <p
                            key={`locked-${index}`}
                            className="text-[var(--ls-text-muted)]"
                          >
                            {line}
                          </p>
                        ))}
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[var(--ls-bg-elevated)] via-[var(--ls-bg-elevated)]/95 to-transparent"
                      >
                        <div className="px-4 py-8 text-center">
                          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--ls-border-strong)] bg-[var(--ls-bg)] text-[var(--ls-sand)]">
                            <Lock size={22} weight="regular" />
                          </div>
                          <h3 className="font-fraunces italic lowercase text-xl text-[var(--ls-text)] mb-2">
                            unlock full script
                          </h3>
                          <p className="mx-auto mb-5 max-w-xs text-xs text-[var(--ls-text-muted)] leading-relaxed">
                            upgrade to pro to read the complete hypnosis script and access advanced features
                          </p>
                          <button
                            type="button"
                            onClick={handleUnlockPro}
                            className="inline-flex items-center gap-2 rounded-md border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/10 px-5 py-2 text-sm lowercase text-[var(--ls-sand)] transition-colors hover:bg-[var(--ls-sand)]/15"
                          >
                            <Lock size={14} weight="regular" />
                            unlock with pro
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-[var(--ls-text-muted)]">
                  {t('sessionDetail.scriptUnavailable')}
                </p>
              )}
            </div>
          </section>

          {/* Pro: regenerate */}
          {isProUser && (
            <section>
              <button
                type="button"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending || session.status === 'generating'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] px-4 py-3 text-sm lowercase text-[var(--ls-text)] transition-colors hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-sand)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {regenerateMutation.isPending ? (
                  <>
                    <Spinner size={14} className="animate-spin" />
                    {t('sessionDetail.regenerating')}
                  </>
                ) : (
                  <>
                    <Waveform size={14} weight="regular" />
                    {t('sessionDetail.regenerateCta')}
                  </>
                )}
              </button>
            </section>
          )}

          {/* Delete */}
          <section className="pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 py-3 text-xs lowercase tracking-wide text-[var(--ls-text-subtle)] transition-colors hover:text-[var(--ls-danger)] disabled:opacity-50"
            >
              <Trash size={13} weight="regular" />
              {deleteMutation.isPending ? t('sessionDetail.deleting') : t('sessionDetail.deleteSessionCta')}
            </button>
          </section>
        </div>
      </div>

      {/* Bottom play bar — flat, near-black, hairline border, sand CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--ls-border)] bg-[var(--ls-bg)] px-5 py-4">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={onPlay}
            disabled={!isReady}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/10 text-sm lowercase tracking-wide text-[var(--ls-sand)] transition-colors hover:bg-[var(--ls-sand)]/15 disabled:cursor-not-allowed disabled:border-[var(--ls-border)] disabled:bg-transparent disabled:text-[var(--ls-text-subtle)]"
          >
            <Play size={16} weight={isReady ? 'fill' : 'regular'} />
            {isReady ? t('sessionDetail.playCta') : t('sessionDetail.preparingAudio')}
          </button>
        </div>
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
