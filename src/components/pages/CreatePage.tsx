import { Fragment, useState, useEffect, useRef } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { CaretDown, Lock } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay'
import { SessionPreviewScreen } from '@/components/SessionPreviewScreen'
import { ScriptEditorModal } from '@/components/ScriptEditorModal'
import { RecentCreations } from '@/components/RecentCreations'
import { PaywallModal } from '@/components/PaywallModal'
import { requestUpgradePage } from '@/lib/upgrade-intent'
import { useAuth } from '@/lib/auth-context'
import {
  generateSession,
  getSession,
  listSessions,
  regenerateSessionAudio,
  deleteSession,
  cancelSessionGeneration,
  editSessionScript,
  type SessionDetail,
} from '@/lib/api-endpoints'
import { ApiError } from '@/lib/api'
import { getAuthToken } from '@/lib/auth'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useKV } from '@/hooks/use-kv'
import { formatCategory } from '@/lib/session-ui'

// Backend is the source of truth for library sessions — the old local
// `useKV('library-sessions')` state is no longer used here.

const PLACEHOLDER_EXAMPLES = [
  "i can't fall asleep, my mind is racing",
  'i want to feel calm before my interview tomorrow',
  'help me let go of the day',
  'i want to stop checking my phone at night',
] as const

const MAX_CHARS = 500
const MIN_CHARS = 10 // backend requires >= 10

/** Lengths visible to the user. Free plan only sees 5; pro sees both. */
const LENGTH_OPTIONS = [5, 10] as const

/** Templates collapsed to a single discreet suggestion line. */
const TEMPLATE_SUGGESTIONS = [
  { label: 'better sleep', prompt: "i can't fall asleep, my mind keeps spinning. help me let go." },
  { label: 'calm anxiety', prompt: 'i feel anxious and on edge. guide me back to calm.' },
  { label: 'deep focus', prompt: 'i need to enter deep focus for important work.' },
  { label: 'release fear', prompt: 'i want to let go of a fear that keeps holding me back.' },
] as const

const VOICE_OPTIONS = [
  { id: 'en-US-AnaNeural', labelKey: 'create.voices.calmFemale', pro: false },
  { id: 'en-US-GuyNeural', labelKey: 'create.voices.deepMale', pro: false },
  { id: 'en-US-AriaNeural', labelKey: 'create.voices.softWhisper', pro: false },
  { id: 'en-AU-NatashaNeural', labelKey: 'create.voices.warmAustralian', pro: false },
  { id: 'en-GB-SoniaNeural', labelKey: 'create.voices.gentleBritish', pro: true },
  { id: 'en-US-DavisNeural', labelKey: 'create.voices.steadyGuide', pro: true },
] as const

const BACKGROUND_SOUNDS = [
  { id: 'silence', labelKey: 'create.backgrounds.silence' },
  { id: 'rain', labelKey: 'create.backgrounds.rain' },
  { id: 'ocean', labelKey: 'create.backgrounds.ocean' },
  { id: 'forest', labelKey: 'create.backgrounds.forest' },
  { id: 'wind', labelKey: 'create.backgrounds.wind' },
] as const

const INDUCTION_STYLES: ReadonlyArray<{ id: string; labelKey: string | null; fallback?: string }> = [
  { id: 'progressive', labelKey: 'create.inductions.progressive' },
  { id: 'countdown', labelKey: 'create.inductions.countdown' },
  { id: 'body-scan', labelKey: null, fallback: 'body scan' },
]

type DepthLevel = 'light' | 'medium' | 'deep'

// Liminal `--ls-*` tokens are page-local (not defined on :root), so this
// page must declare them itself. Without this block hover/selected states
// on the length / voice / background / induction / depth buttons collapse
// to invisible borders and there is no visible feedback while choosing
// session options.
const STYLES = `
.ls-create {
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
.ls-create .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

/**
 * Heuristic mapping from free-text prompts to backend category slugs.
 * Order matters: the first keyword that matches wins. Falls back to
 * `custom` when nothing matches.
 */
function inferCategory(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (/\b(sleep|insomnia|rest)\b/.test(lower)) return 'sleep'
  if (/\b(confidence|self[- ]esteem|assertive)\b/.test(lower)) return 'confidence'
  if (/\b(fear|phobia|anxious|anxiety|panic)\b/.test(lower)) return 'fears'
  if (/\b(habit|smoking|weight|eating|drinking)\b/.test(lower)) return 'habits'
  if (/\b(focus|concentration|study|exam)\b/.test(lower)) return 'focus'
  return 'custom'
}

export function CreatePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isPro = user?.plan === 'pro'
  const qc = useQueryClient()
  const { play } = useAudioPlayer()

  // User-configured defaults from PreferencesPage. These persist via
  // the Redis-backed KV hook, so a returning user starts the Create
  // form pre-filled with their last-saved choices instead of the
  // hard-coded defaults.
  const [defaultVoiceKV] = useKV<string>('default-voice', 'en-US-AnaNeural')
  const [defaultLengthKV] = useKV<string>('default-session-length', '15')
  const [defaultBackgroundKV] = useKV<string>('background-sound', 'rain')

  const [inputValue, setInputValue] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState(() => defaultVoiceKV ?? 'en-US-AnaNeural')
  const [selectedCategory, _setSelectedCategory] = useState<string | null>(null)
  const [sessionLength, setSessionLength] = useState<number>(() => {
    const stored = Number(defaultLengthKV ?? '5')
    return LENGTH_OPTIONS.includes(stored as 5 | 10) ? stored : 5
  })
  const [backgroundSound, setBackgroundSound] = useState(() => defaultBackgroundKV ?? 'rain')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [inductionStyle, setInductionStyle] = useState('progressive')
  const [depthLevel, setDepthLevel] = useState<DepthLevel>('medium')
  const [wakeUpEnding, setWakeUpEnding] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [generatedSession, setGeneratedSession] = useState<SessionDetail | null>(null)
  const [showScriptEditor, setShowScriptEditor] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallTrigger, setPaywallTrigger] = useState<'session-limit' | 'premium-voice'>('session-limit')

  // Live generation progress driven by the backend SSE stream. The
  // overlay (GenerationLoadingOverlay) reads these to highlight the
  // correct step instead of relying on fake timers.
  const [generationStep, setGenerationStep] = useState<string>('queued')
  const [generationPercent, setGenerationPercent] = useState<number>(0)
  const [generationMessage, setGenerationMessage] = useState<string>('Waiting in queue...')

  // Holds the current SSE EventSource so we can close it on cancel /
  // unmount. Kept in a ref so re-renders don't orphan subscriptions.
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Make sure any open SSE stream is closed when the component
  // unmounts — otherwise the backend keeps a handler alive for the
  // full 5-minute timeout.
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  /**
   * Subscribe to the SSE progress stream for a newly-generated
   * session.
   *
   * The backend (see `apps/api/src/modules/sessions/sessions.sse.ts`)
   * emits just two named events:
   *
   *   - `progress` — every update, including the terminal
   *     `{ step: 'done', progress: 100, audioUrl }` and
   *     `{ step: 'error', message, error }` payloads.
   *   - `close` — a book-end sent right before `res.end()`.
   *
   * We therefore key off `event.step` inside the `progress` handler
   * rather than listening for `done` / `error` as named events
   * (previous implementation did, which meant successful generations
   * closed the stream → `onerror` fired → the promise rejected with
   * "Lost connection" even though the audio was ready).
   *
   * Resolves with the final session detail when `step === 'done'`;
   * rejects with the server-provided message when `step === 'error'`.
   */
  const subscribeToGeneration = (sessionId: string) =>
    new Promise<SessionDetail>((resolve, reject) => {
      const token = getAuthToken()
      if (!token) {
        reject(new Error('Not authenticated'))
        return
      }
      // EventSource can't set headers, so the backend accepts the JWT
      // as a query param on this specific route (see authenticateFromQuery).
      const url = `/api/sessions/${encodeURIComponent(sessionId)}/events?token=${encodeURIComponent(token)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      // Track whether we've already resolved/rejected so a subsequent
      // `onerror` (which `EventSource` fires automatically when the
      // server closes the connection after a terminal event) does not
      // overwrite a successful completion with a spurious failure.
      let settled = false
      const done = (fn: () => void) => {
        if (settled) return
        settled = true
        es.close()
        if (eventSourceRef.current === es) eventSourceRef.current = null
        fn()
      }

      es.addEventListener('progress', (ev) => {
        let payload: {
          step?: string
          progress?: number
          message?: string
          audioUrl?: string
          error?: string
        } = {}
        try {
          payload = JSON.parse((ev as MessageEvent).data)
        } catch {
          // Malformed payload / keepalive — nothing to do.
          return
        }

        if (typeof payload.step === 'string') setGenerationStep(payload.step)
        if (typeof payload.progress === 'number') setGenerationPercent(payload.progress)
        if (typeof payload.message === 'string') setGenerationMessage(payload.message)

        if (payload.step === 'done') {
          done(async () => {
            try {
              const detail = await getSession(sessionId)
              resolve(detail)
            } catch (err) {
              reject(err)
            }
          })
          return
        }

        if (payload.step === 'error') {
          const msg = payload.error || payload.message || 'Generation failed'
          done(() => reject(new Error(msg)))
        }
      })

      es.onerror = () => {
        // Only treat this as a failure if we haven't already finished.
        // The browser auto-reconnects; once the server has closed the
        // stream after a terminal `progress` event there's nothing to
        // reconnect to, and `done()` is a no-op for the settled case.
        done(() => reject(new Error('Lost connection to generation stream')))
      }
    })

  // Tracks the in-flight session id so handleCancelGeneration can
  // POST to the server-side cancel endpoint, not just close the SSE.
  // Cleared on every settled outcome (success / error / cancel).
  const activeSessionIdRef = useRef<string | null>(null)

  const handleGenerate = async () => {
    if (!inputValue.trim()) return

    setIsGenerating(true)
    // Reset progress state so a prior cancelled/failed run doesn't
    // leak into the new one.
    setGenerationStep('queued')
    setGenerationPercent(0)
    setGenerationMessage('Waiting in queue...')
    try {
      const category = selectedCategory ?? inferCategory(inputValue)
      const { sessionId } = await generateSession({
        userPrompt: inputValue.trim(),
        durationMin: sessionLength,
        voiceId: selectedVoice,
        inductionStyle,
        depthLevel,
        wakeUpAtEnd: wakeUpEnding,
        background: backgroundSound,
        category,
      })
      activeSessionIdRef.current = sessionId

      const detail = await subscribeToGeneration(sessionId)
      activeSessionIdRef.current = null
      setGeneratedSession(detail)
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setIsGenerating(false)
      setShowPreview(true)
    } catch (err) {
      setIsGenerating(false)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      activeSessionIdRef.current = null

      if (err instanceof ApiError) {
        if (err.status === 402) {
          setPaywallTrigger('session-limit')
          setShowPaywall(true)
          return
        }
        if (err.code === 'PREMIUM_VOICE') {
          setPaywallTrigger('premium-voice')
          setShowPaywall(true)
          return
        }
        // Safety / script-generation failures carry a machine-readable
        // `reason` (e.g. "self-harm", "medical advice") in `details`.
        // Surface it verbatim so the user knows *why* their prompt was
        // rejected. The prompt itself stays in `inputValue` (we never
        // clear it on error) so they can edit-and-retry without
        // retyping.
        if (err.code === 'GENERATION_FAILED') {
          const details = err.details as { reason?: string } | undefined
          const reason = details?.reason?.trim()
          toast.error(
            reason
              ? `${err.message} (${reason})`
              : err.message || t('create.toastGenerationFailedFallback'),
          )
          return
        }
        toast.error(err.message || t('create.toastGenerationFailedFallback'))
        return
      }
      toast.error(err instanceof Error ? err.message : t('create.toastGenerationFailed'))
    }
  }

  const handleCancelGeneration = () => {
    const sid = activeSessionIdRef.current
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setIsGenerating(false)
    // Server-side abort: tells the worker to skip the next steps and
    // refunds the user's quota slot. Best-effort — local UI state is
    // already in the cancelled state regardless of network outcome.
    if (sid) {
      void cancelSessionGeneration(sid).catch(() => {
        /* swallow — local state is already cancelled */
      })
    }
    activeSessionIdRef.current = null
    toast.info(t('create.toastGenerationCancelled'))
  }

  const handleListenNow = () => {
    if (!generatedSession) return
    play({
      sessionId: generatedSession.status === 'ready' ? generatedSession.id : undefined,
      title: generatedSession.title,
      category: formatCategory(generatedSession.category),
      duration: generatedSession.durationSec,
    })
    setShowPreview(false)
  }

  const handleEditScript = () => {
    setShowPreview(false)
    setShowScriptEditor(true)
  }

  const handleSaveScript = async (edited: string, _modified: Set<number>) => {
    if (!generatedSession) {
      setShowScriptEditor(false)
      setShowPreview(true)
      return
    }
    try {
      // Persist the edited script to the backend so the change isn't
      // silently lost when the user dismisses the preview. The audio
      // does not auto-regenerate — the next "Regenerate audio" click
      // is responsible for re-running TTS against the new script.
      await editSessionScript(generatedSession.id, edited)
      // Mirror the edit into local state so the preview re-opens with
      // the new text without an extra round-trip.
      setGeneratedSession({ ...generatedSession, scriptText: edited })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(t('create.toastScriptSaved'))
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setPaywallTrigger('premium-voice')
        setShowPaywall(true)
        return
      }
      toast.error(err instanceof Error ? err.message : t('create.toastScriptError'))
      return
    }
    setShowScriptEditor(false)
    setShowPreview(true)
  }

  const handleCloseEditor = () => {
    setShowScriptEditor(false)
    setShowPreview(true)
  }

  const handleRegenerate = async () => {
    if (!generatedSession) return
    try {
      await regenerateSessionAudio(generatedSession.id)
      toast.success(t('create.toastRegenStarted'))
      setShowPreview(false)
      qc.invalidateQueries({ queryKey: ['sessions'] })
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setPaywallTrigger('session-limit')
        setShowPaywall(true)
        return
      }
      toast.error(t('create.toastRegenAudioError'))
    }
  }

  const handleClosePreview = () => {
    setShowPreview(false)
    setInputValue('')
    setGeneratedSession(null)
  }

  const handleVoiceSelect = (voiceId: string) => {
    const voice = VOICE_OPTIONS.find((v) => v.id === voiceId)
    if (voice?.pro && !isPro) {
      setPaywallTrigger('premium-voice')
      setShowPaywall(true)
      return
    }
    setSelectedVoice(voiceId)
  }

  const handleUpgrade = () => {
    setShowPaywall(false)
    requestUpgradePage()
    window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'profile' }))
  }

  const handleClosePaywall = () => setShowPaywall(false)

  const handlePlaySession = async (sessionId: string) => {
    // Fetch the latest session detail so we use the real title /
    // category / duration rather than the abbreviated card data —
    // and so we know whether the audio is actually `ready` (templates
    // and in-flight generations should preview, not stream).
    try {
      const detail = await getSession(sessionId)
      play({
        sessionId: detail.status === 'ready' ? detail.id : undefined,
        title: detail.title,
        category: formatCategory(detail.category),
        duration: detail.durationSec,
      })
    } catch {
      toast.error(t('create.toastLoadFailed'))
    }
  }

  const handleEditSession = async (sessionId: string) => {
    // Open the script editor for an existing session by hydrating the
    // CreatePage's `generatedSession` with the row from the backend
    // and switching to the editor modal.
    try {
      const detail = await getSession(sessionId)
      setGeneratedSession(detail)
      setShowPreview(false)
      setShowScriptEditor(true)
    } catch {
      toast.error(t('create.toastEditOpenFailed'))
    }
  }

  const handleRegenerateAudio = async (sessionId: string) => {
    try {
      await regenerateSessionAudio(sessionId)
      toast.success(t('create.toastRegenStarted'))
      qc.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      toast.error(t('create.toastRegenError'))
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(t('create.toastSessionDeleted'))
    } catch {
      toast.error(t('create.toastDeleteError'))
    }
  }

  const charCount = inputValue.length
  const isOverLimit = charCount > MAX_CHARS
  const isEmpty = inputValue.trim().length === 0
  const isTooShort = inputValue.trim().length > 0 && inputValue.trim().length < MIN_CHARS

  const previewScript = generatedSession?.scriptText ?? ''
  const previewCategory = generatedSession ? formatCategory(generatedSession.category) : 'Custom'
  const previewDuration = generatedSession
    ? `${Math.round(generatedSession.durationSec / 60)} min`
    : '15 min'

  return (
    <>
      <div className="ls-create min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
        <style>{STYLES}</style>
        <div className="mx-auto max-w-xl px-6 pt-12 pb-24 space-y-10">

          {/* === HEADER === */}
          <header className="space-y-2">
            <h1 className="font-fraunces italic lowercase text-4xl text-[var(--ls-text)]">
              {t('create.promptLabel')}
            </h1>
            <p className="text-sm text-[var(--ls-text-muted)]">
              {t('create.subtitle')}
            </p>
          </header>

          {/* === PROMPT === */}
          <section className="space-y-2">
            <div className="relative">
              <Textarea
                id="session-description"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={MAX_CHARS}
                className="min-h-[180px] w-full resize-none bg-transparent border-0 border-b border-[var(--ls-border-strong)] rounded-none px-0 py-3 text-base leading-relaxed text-[var(--ls-text)] placeholder:text-[var(--ls-text-subtle)] focus-visible:ring-0 focus-visible:border-[var(--ls-sand)] transition-colors"
                placeholder=""
              />
              {isEmpty && (
                <div className="absolute top-3 left-0 pointer-events-none text-[var(--ls-text-subtle)]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.4 }}
                      className="text-base italic"
                    >
                      {PLACEHOLDER_EXAMPLES[placeholderIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Char counter — only when typing, sand for warning, never alarmist */}
            <div className="flex justify-between items-center text-xs">
              <div className="text-[var(--ls-text-subtle)]">
                {isTooShort && !isEmpty && <span>{t('create.errorTooShort')}</span>}
              </div>
              <div
                className={
                  isOverLimit
                    ? 'text-[var(--ls-sand)]'
                    : 'text-[var(--ls-text-subtle)]'
                }
              >
                {charCount}/{MAX_CHARS}
              </div>
            </div>

            {/* Inline template suggestions, discreet */}
            <div className="pt-1 text-sm text-[var(--ls-text-subtle)]">
              <span>try:&nbsp;</span>
              {TEMPLATE_SUGGESTIONS.map((t, i) => (
                <Fragment key={t.label}>
                  {i > 0 && <span className="text-[var(--ls-text-subtle)]">&nbsp;·&nbsp;</span>}
                  <button
                    type="button"
                    onClick={() => setInputValue(t.prompt)}
                    className="text-[var(--ls-text-muted)] hover:text-[var(--ls-sand)] transition-colors underline-offset-4 hover:underline"
                  >
                    {t.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </section>

          {/* === LENGTH (2 buttons, free user sees 10 locked) === */}
          <section className="space-y-3">
            <h2 className="font-fraunces italic lowercase text-lg text-[var(--ls-text)]">
              {t('create.lengthLabel')}
            </h2>
            <div className="flex gap-3">
              {LENGTH_OPTIONS.map((min) => {
                const isLocked = !isPro && min === 10
                const isActive = sessionLength === min
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setPaywallTrigger('session-limit')
                        setShowPaywall(true)
                        return
                      }
                      setSessionLength(min)
                    }}
                    className={[
                      'relative flex-1 h-14 rounded-md border transition-colors flex items-center justify-center gap-2',
                      isActive
                        ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/8 text-[var(--ls-text)]'
                        : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)]',
                    ].join(' ')}
                  >
                    <span className="font-fraunces italic text-xl lowercase">
                      {min === 5 ? t('create.length5') : min === 10 ? t('create.length10') : `${min} min`}
                    </span>
                    {isLocked && (
                      <Lock
                        size={14}
                        weight="regular"
                        className="text-[var(--ls-sand-dim)] ml-1"
                      />
                    )}
                  </button>
                )
              })}
            </div>
            {!isPro && (
              <p className="text-xs text-[var(--ls-text-subtle)]">
                longer sessions on pro
              </p>
            )}
          </section>

          {/* === VOICE === */}
          <section className="space-y-3">
            <h2 className="font-fraunces italic lowercase text-lg text-[var(--ls-text)]">
              {t('create.voiceLabel')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {VOICE_OPTIONS.map((voice) => {
                const isLocked = voice.pro && !isPro
                const isActive = selectedVoice === voice.id
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleVoiceSelect(voice.id)}
                    className={[
                      'inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-sm transition-colors',
                      isActive
                        ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/8 text-[var(--ls-text)]'
                        : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)]',
                    ].join(' ')}
                  >
                    <span>{t(voice.labelKey)}</span>
                    {isLocked && (
                      <Lock
                        size={12}
                        weight="regular"
                        className="text-[var(--ls-sand-dim)]"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          {/* === ADVANCED DISCLOSURE === */}
          <section>
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center gap-2 text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
            >
              <CaretDown
                size={14}
                weight="regular"
                className={`transition-transform duration-300 ${
                  isAdvancedOpen ? 'rotate-180' : ''
                }`}
              />
              <span>{isAdvancedOpen ? 'hide options' : t('create.advancedLabel')}</span>
            </button>

            <AnimatePresence initial={false}>
              {isAdvancedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-6">

                    {/* Background sound — text-only chips */}
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                        {t('create.backgroundLabel')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {BACKGROUND_SOUNDS.map((s) => {
                          const isActive = backgroundSound === s.id
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setBackgroundSound(s.id)}
                              className={[
                                'px-3 h-8 rounded-full border text-sm transition-colors',
                                isActive
                                  ? 'border-[var(--ls-sand)] text-[var(--ls-text)]'
                                  : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:text-[var(--ls-text)]',
                              ].join(' ')}
                            >
                              {t(s.labelKey)}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Induction style */}
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                        {t('create.inductionLabel')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {INDUCTION_STYLES.map((style) => {
                          const isActive = inductionStyle === style.id
                          return (
                            <button
                              key={style.id}
                              type="button"
                              onClick={() => setInductionStyle(style.id)}
                              className={[
                                'px-3 h-8 rounded-full border text-sm transition-colors',
                                isActive
                                  ? 'border-[var(--ls-sand)] text-[var(--ls-text)]'
                                  : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:text-[var(--ls-text)]',
                              ].join(' ')}
                            >
                              {style.labelKey ? t(style.labelKey) : style.fallback}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Depth level */}
                    <div className="space-y-2">
                      <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
                        {t('create.depthLabel')}
                      </h3>
                      <div className="flex gap-2">
                        {(['light', 'medium', 'deep'] as const).map((d) => {
                          const isActive = depthLevel === d
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDepthLevel(d)}
                              className={[
                                'flex-1 h-9 rounded-md border text-sm transition-colors lowercase',
                                isActive
                                  ? 'border-[var(--ls-sand)] text-[var(--ls-text)]'
                                  : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:text-[var(--ls-text)]',
                              ].join(' ')}
                            >
                              {t(`create.depths.${d}`)}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Wake-up ending */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--ls-border)]">
                      <div>
                        <h3 className="text-sm text-[var(--ls-text)]">
                          {t('create.wakeUpLabel')}
                        </h3>
                        <p className="text-xs text-[var(--ls-text-subtle)] mt-0.5">
                          bring me back gently at the end
                        </p>
                      </div>
                      <Switch
                        checked={wakeUpEnding}
                        onCheckedChange={setWakeUpEnding}
                        className="data-[state=checked]:bg-[var(--ls-sand)]"
                      />
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* === GENERATE === */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isEmpty || isOverLimit || isTooShort || isGenerating}
            className={[
              'w-full h-14 rounded-md font-fraunces italic lowercase text-lg transition-colors',
              'bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90',
              'disabled:bg-[var(--ls-border-strong)] disabled:text-[var(--ls-text-subtle)] disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {isGenerating ? t('create.generating') : t('create.generateCta')}
          </button>

        </div>
      </div>

      <RecentCreationsContainer
        onPlay={handlePlaySession}
        onEdit={handleEditSession}
        onRegenerate={handleRegenerateAudio}
        onDelete={handleDeleteSession}
      />

      <GenerationLoadingOverlay
        isOpen={isGenerating}
        onCancel={handleCancelGeneration}
        step={generationStep}
        percent={generationPercent}
        message={generationMessage}
      />

      {generatedSession && (
        <>
          <SessionPreviewScreen
            isOpen={showPreview}
            sessionTitle={generatedSession.title}
            category={previewCategory}
            duration={previewDuration}
            scriptText={previewScript}
            onListenNow={handleListenNow}
            onEditScript={handleEditScript}
            onRegenerate={handleRegenerate}
            onClose={handleClosePreview}
          />

          <ScriptEditorModal
            isOpen={showScriptEditor}
            onClose={handleCloseEditor}
            initialScript={previewScript}
            sessionId={generatedSession.id}
            onSave={handleSaveScript}
          />
        </>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={handleClosePaywall}
        onUpgrade={handleUpgrade}
        triggerReason={paywallTrigger}
      />
    </>
  )
}

/**
 * Thin wrapper so `RecentCreations` can live in its own section of the
 * page without CreatePage needing to re-run the sessions query at the
 * top level. The query is shared (same key) with LibraryPage, so data
 * is cached cross-tab.
 */
function RecentCreationsContainer(props: {
  onPlay: (id: string) => void
  onEdit: (id: string) => void
  onRegenerate: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { data } = useRecentSessionsQuery()
  return (
    <RecentCreations
      sessions={(data ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        duration: `${Math.max(1, Math.round(s.durationSec / 60))} min`,
        createdAt: new Date(s.createdAt).getTime(),
        playCount: s.playCount,
      }))}
      onPlay={props.onPlay}
      onEdit={props.onEdit}
      onRegenerate={props.onRegenerate}
      onDelete={props.onDelete}
    />
  )
}

function useRecentSessionsQuery() {
  return useQuery({
    queryKey: ['sessions', { limit: 5, sort: 'newest', category: 'all', favoritesOnly: false }],
    queryFn: async () => {
      const env = await listSessions({ limit: 5, sort: 'newest' })
      return env.data
    },
  })
}
