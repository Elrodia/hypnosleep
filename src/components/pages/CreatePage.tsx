import { useState, useEffect, useRef } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Sparkle, Play, Drop, Waves, Tree, Wind, SpeakerSlash, CaretDown, Moon, Sun, Prohibit, BookOpen, LockKeyOpen, Eye, AppleLogo, FirstAid } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { GenerationLoadingOverlay } from '@/components/GenerationLoadingOverlay'
import { SessionPreviewScreen } from '@/components/SessionPreviewScreen'
import { ScriptEditorModal } from '@/components/ScriptEditorModal'
import { RecentCreations } from '@/components/RecentCreations'
import { PaywallModal } from '@/components/PaywallModal'
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
  'Help me fall asleep in 10 minutes',
  'Boost my confidence for a job interview',
  'Release my fear of public speaking',
]

const MAX_CHARS = 500

interface QuickTemplate {
  id: string
  label: string
  icon: React.ComponentType<any>
  prompt: string
  voice: string
  duration: number
  category: string
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  { id: 'sleep-10', label: 'Sleep in 10 min', icon: Moon, prompt: 'Help me fall asleep quickly with deep relaxation in 10 minutes', voice: 'en-US-AriaNeural', duration: 10, category: 'sleep' },
  { id: 'morning-confidence', label: 'Morning Confidence', icon: Sun, prompt: 'Boost my confidence and energy for a successful day ahead', voice: 'en-US-AnaNeural', duration: 10, category: 'confidence' },
  { id: 'quit-smoking', label: 'Quit Smoking', icon: Prohibit, prompt: 'Strengthen my resolve to quit smoking and overcome cravings', voice: 'en-US-GuyNeural', duration: 15, category: 'habits' },
  { id: 'exam-calm', label: 'Exam Calm', icon: BookOpen, prompt: 'Release test anxiety and boost focus for my upcoming exam', voice: 'en-US-AnaNeural', duration: 15, category: 'focus' },
  { id: 'fear-release', label: 'Fear Release', icon: LockKeyOpen, prompt: 'Let go of my fears and embrace courage and confidence', voice: 'en-GB-SoniaNeural', duration: 20, category: 'fears' },
  { id: 'deep-focus', label: 'Deep Focus', icon: Eye, prompt: 'Enter a state of deep focus and concentration for important work', voice: 'en-US-GuyNeural', duration: 15, category: 'focus' },
  { id: 'weight-control', label: 'Weight Control', icon: AppleLogo, prompt: 'Develop healthy eating habits and positive body image', voice: 'en-US-AnaNeural', duration: 20, category: 'habits' },
  { id: 'pain-relief', label: 'Pain Relief', icon: FirstAid, prompt: 'Reduce physical discomfort and promote natural healing', voice: 'en-US-AriaNeural', duration: 15, category: 'custom' },
]

// Voice IDs match the backend `VOICES` registry (Azure TTS names); the
// user-facing label is the only part we render.
const VOICE_OPTIONS = [
  { id: 'en-US-AnaNeural', label: 'Calm Female', pro: false },
  { id: 'en-US-GuyNeural', label: 'Deep Male', pro: false },
  { id: 'en-US-AriaNeural', label: 'Soft Whisper', pro: true },
  { id: 'en-GB-SoniaNeural', label: 'Gentle British', pro: true },
  { id: 'en-AU-NatashaNeural', label: 'Warm Australian', pro: true },
  { id: 'en-US-DavisNeural', label: 'Steady Guide', pro: true },
]

const BACKGROUND_SOUNDS = [
  { id: 'rain', label: 'Rain', icon: Drop },
  { id: 'ocean', label: 'Ocean', icon: Waves },
  { id: 'forest', label: 'Forest', icon: Tree },
  { id: 'wind', label: 'Wind', icon: Wind },
  { id: 'silence', label: 'Silence', icon: SpeakerSlash },
]

const INDUCTION_STYLES = [
  { id: 'progressive', label: 'Progressive Relaxation' },
  { id: 'countdown', label: 'Countdown' },
  { id: 'body-scan', label: 'Body Scan' },
]

type DepthLevel = 'light' | 'medium' | 'deep'

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sessionLength, setSessionLength] = useState<number[]>(() => [
    Number.parseInt(defaultLengthKV ?? '15', 10) || 15,
  ])
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
        durationMin: sessionLength[0],
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
              : err.message || 'Could not generate session.',
          )
          return
        }
        toast.error(err.message || 'Could not generate session.')
        return
      }
      toast.error(err instanceof Error ? err.message : 'Generation failed')
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
    toast.info('Session generation cancelled')
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
      toast.success('Script saved')
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setPaywallTrigger('premium-voice')
        setShowPaywall(true)
        return
      }
      toast.error(err instanceof Error ? err.message : 'Could not save script.')
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
      toast.success('Regenerating audio…')
      setShowPreview(false)
      qc.invalidateQueries({ queryKey: ['sessions'] })
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setPaywallTrigger('session-limit')
        setShowPaywall(true)
        return
      }
      toast.error('Could not regenerate audio.')
    }
  }

  const handleClosePreview = () => {
    setShowPreview(false)
    setInputValue('')
    setGeneratedSession(null)
  }

  const handleTemplateSelect = (template: QuickTemplate) => {
    setInputValue(template.prompt)
    setSelectedVoice(template.voice)
    setSessionLength([template.duration])
    setSelectedCategory(template.category)
    toast.success(`"${template.label}" template applied!`)
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
    window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'profile' }))
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('show-subscription'))
    }, 100)
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
      toast.error('Could not load session.')
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
      toast.error('Could not open session for editing.')
    }
  }

  const handleRegenerateAudio = async (sessionId: string) => {
    try {
      await regenerateSessionAudio(sessionId)
      toast.success('Regenerating audio…')
      qc.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      toast.error('Could not regenerate.')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      qc.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session deleted')
    } catch {
      toast.error('Could not delete session.')
    }
  }

  const charCount = inputValue.length
  const isOverLimit = charCount > MAX_CHARS
  const isEmpty = inputValue.trim().length === 0

  const previewScript = generatedSession?.scriptText ?? ''
  const previewCategory = generatedSession ? formatCategory(generatedSession.category) : 'Custom'
  const previewDuration = generatedSession
    ? `${Math.round(generatedSession.durationSec / 60)} min`
    : '15 min'

  return (
    <>
      <div className="space-y-6">
        <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center p-6">
          <div className="w-full max-w-2xl space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Quick Templates</h3>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {QUICK_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-card/50 border border-border hover:bg-card hover:border-primary/50 transition-all shrink-0 min-w-[100px] active:scale-95"
                  >
                    <Icon size={24} weight="duotone" className="text-primary" />
                    <span className="text-xs font-medium text-foreground text-center whitespace-nowrap">
                      {template.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="relative">
            <Textarea
              id="session-description"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="min-h-[240px] text-base resize-none bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-2 focus-visible:ring-primary/50"
              maxLength={MAX_CHARS}
            />
            
            {isEmpty && (
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="text-muted-foreground/60">
                  <div className="mb-1">Describe what you want to work on...</div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm italic text-primary/40"
                    >
                      {PLACEHOLDER_EXAMPLES[placeholderIndex]}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div
              className={`absolute bottom-3 right-3 text-xs font-medium transition-colors ${
                isOverLimit
                  ? 'text-destructive'
                  : charCount > MAX_CHARS * 0.9
                  ? 'text-yellow-500'
                  : 'text-muted-foreground'
              }`}
            >
              {charCount}/{MAX_CHARS}
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Voice</h3>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
                {VOICE_OPTIONS.map((voice) => {
                  const isPremium = voice.pro
                  return (
                    <button
                      key={voice.id}
                      onClick={() => handleVoiceSelect(voice.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all shrink-0 relative ${
                        selectedVoice === voice.id
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-card/50 text-foreground hover:bg-card border border-border'
                      }`}
                    >
                      <span className="text-sm font-medium">{voice.label}</span>
                      {isPremium && !isPro && (
                        <LockKeyOpen
                          weight="bold"
                          size={14}
                          className="text-primary"
                        />
                      )}
                      <Play
                        weight="fill"
                        size={14}
                        className={selectedVoice === voice.id ? 'opacity-100' : 'opacity-50'}
                      />
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Session Length</h3>
              <div className="relative pt-8 pb-2">
                <Slider
                  value={sessionLength}
                  onValueChange={setSessionLength}
                  min={5}
                  max={30}
                  step={5}
                  className="[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-thumb]]:size-7 [&_[data-slot=slider-thumb]]:border-4"
                />
                <div
                  className="absolute -top-1 text-2xl font-bold text-primary transition-all duration-200 pointer-events-none"
                  style={{
                    left: `calc(${((sessionLength[0] - 5) / (30 - 5)) * 100}% - 20px)`,
                  }}
                >
                  {sessionLength[0]} min
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>5 min</span>
                <span>30 min</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Background Sound</h3>
              <div className="flex gap-3 justify-between">
                {BACKGROUND_SOUNDS.map((sound) => {
                  const Icon = sound.icon
                  return (
                    <button
                      key={sound.id}
                      onClick={() => setBackgroundSound(sound.id)}
                      className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all aspect-square flex-1 ${
                        backgroundSound === sound.id
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                          : 'bg-card/50 text-foreground hover:bg-card border border-border'
                      }`}
                      title={sound.label}
                    >
                      <Icon
                        weight={backgroundSound === sound.id ? 'fill' : 'regular'}
                        size={24}
                      />
                      <span className="text-xs font-medium">{sound.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <button
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex items-center justify-between w-full text-left group"
              >
                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Advanced Settings
                </h3>
                <CaretDown
                  size={18}
                  weight="bold"
                  className={`text-muted-foreground group-hover:text-primary transition-all duration-300 ${
                    isAdvancedOpen ? 'rotate-180' : ''
                  }`}
                />
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
                    <div className="pt-4 space-y-5">
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Induction Style</h4>
                        <div className="flex gap-2">
                          {INDUCTION_STYLES.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setInductionStyle(style.id)}
                              className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                inductionStyle === style.id
                                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                  : 'bg-card/50 text-foreground hover:bg-card border border-border'
                              }`}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Depth Level</h4>
                        <div className="flex gap-4 justify-center items-center py-2">
                          <button
                            onClick={() => setDepthLevel('light')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 transition-all ${
                                depthLevel === 'light'
                                  ? 'border-primary bg-primary/10 scale-110'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'light' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Light
                            </span>
                          </button>

                          <button
                            onClick={() => setDepthLevel('medium')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 relative overflow-hidden transition-all ${
                                depthLevel === 'medium'
                                  ? 'border-primary scale-110'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div
                                className={`absolute inset-0 transition-colors ${
                                  depthLevel === 'medium' ? 'bg-primary' : 'bg-border'
                                }`}
                                style={{
                                  clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                                }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'medium' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Medium
                            </span>
                          </button>

                          <button
                            onClick={() => setDepthLevel('deep')}
                            className="flex flex-col items-center gap-2 group"
                          >
                            <div
                              className={`w-12 h-12 rounded-full border-2 transition-all ${
                                depthLevel === 'deep'
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-border bg-border hover:border-primary/50'
                              }`}
                            />
                            <span
                              className={`text-xs font-medium transition-colors ${
                                depthLevel === 'deep' ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            >
                              Deep
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-foreground">Wake-Up Ending</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Gently bring me back at the end
                          </p>
                        </div>
                        <Switch checked={wakeUpEnding} onCheckedChange={setWakeUpEnding} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={isEmpty || isOverLimit || isGenerating}
            className="w-full gap-2 text-base font-medium h-12"
          >
            <Sparkle weight="fill" size={20} />
            {isGenerating ? 'Generating...' : 'Generate Session'}
          </Button>
        </div>
      </div>

      <RecentCreationsContainer
        onPlay={handlePlaySession}
        onEdit={handleEditSession}
        onRegenerate={handleRegenerateAudio}
        onDelete={handleDeleteSession}
      />
    </div>

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
