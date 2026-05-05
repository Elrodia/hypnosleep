import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  generateSession,
  getSession,
  cancelSessionGeneration,
  type GenerateSessionInput,
  type SessionDetail,
} from '@/lib/api-endpoints'
import { getAuthToken } from '@/lib/auth'

/**
 * Global session-generation context.
 *
 * Previously the generation state (`isGenerating`, the SSE
 * subscription, the cancel handler, etc.) lived inside `CreatePage`.
 * That meant the loading overlay was unmounted the moment the user
 * switched bottom-nav tabs — effectively making the loading screen
 * skippable on both mobile and desktop. Hosting the state at the app
 * shell level keeps the overlay alive across tab changes so a
 * generation run cannot be dismissed accidentally.
 *
 * The context exposes a single `runGeneration()` entry point that:
 *  1. POSTs the generate request,
 *  2. subscribes to the backend SSE progress stream,
 *  3. resolves with the final `SessionDetail` once the audio is ready.
 *
 * Errors from the POST (e.g. 402 / paywall, premium-voice gating) are
 * re-thrown so the caller can react with the existing UX. The overlay
 * is closed automatically in every settled outcome (success / error /
 * cancel).
 */

export interface GenerationState {
  isGenerating: boolean
  step: string
  percent: number
  message: string
}

interface GenerationContextType extends GenerationState {
  /**
   * Run the full generate-session flow. Resolves with the final
   * `SessionDetail` when the backend reports `step === 'done'`. The
   * overlay is shown for the entire duration and closed automatically
   * once the promise settles.
   */
  runGeneration: (input: GenerateSessionInput) => Promise<SessionDetail>
  /**
   * Cancel the in-flight generation (server-side abort + close SSE +
   * dismiss the overlay). Safe to call when nothing is running.
   */
  cancel: () => void
}

const GenerationContext = createContext<GenerationContextType | null>(null)

const INITIAL_STATE: GenerationState = {
  isGenerating: false,
  step: 'queued',
  percent: 0,
  message: 'Waiting in queue...',
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<GenerationState>(INITIAL_STATE)

  // Holds the current SSE EventSource so we can close it on cancel /
  // unmount. Kept in a ref so re-renders don't orphan subscriptions.
  const eventSourceRef = useRef<EventSource | null>(null)
  // Tracks the in-flight session id so `cancel()` can POST to the
  // server-side cancel endpoint, not just close the SSE.
  const activeSessionIdRef = useRef<string | null>(null)

  // Defensive cleanup: if the provider ever unmounts (only happens on
  // a full app teardown) make sure no SSE is left dangling.
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  const resetProgress = useCallback(() => {
    setState({
      isGenerating: true,
      step: 'queued',
      percent: 0,
      message: 'Waiting in queue...',
    })
  }, [])

  const closeOverlay = useCallback(() => {
    setState((s) => ({ ...s, isGenerating: false }))
  }, [])

  const subscribe = useCallback(
    (sessionId: string) =>
      new Promise<SessionDetail>((resolve, reject) => {
        const token = getAuthToken()
        if (!token) {
          reject(new Error('Not authenticated'))
          return
        }
        // EventSource can't set headers, so the backend accepts the
        // JWT as a query param on this specific route (see
        // authenticateFromQuery).
        const url = `/api/sessions/${encodeURIComponent(sessionId)}/events?token=${encodeURIComponent(token)}`
        const es = new EventSource(url)
        eventSourceRef.current = es

        // Track whether we've already resolved/rejected so a
        // subsequent `onerror` (which `EventSource` fires
        // automatically when the server closes the connection after a
        // terminal event) does not overwrite a successful completion
        // with a spurious failure.
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
            return
          }

          setState((prev) => ({
            isGenerating: true,
            step: typeof payload.step === 'string' ? payload.step : prev.step,
            percent:
              typeof payload.progress === 'number' ? payload.progress : prev.percent,
            message:
              typeof payload.message === 'string' ? payload.message : prev.message,
          }))

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
          done(() => reject(new Error('Lost connection to generation stream')))
        }
      }),
    [],
  )

  const runGeneration = useCallback(
    async (input: GenerateSessionInput): Promise<SessionDetail> => {
      // If something is already running, refuse to start another run
      // rather than orphaning the previous SSE.
      if (eventSourceRef.current) {
        throw new Error('A generation is already in progress')
      }
      resetProgress()
      try {
        const { sessionId } = await generateSession(input)
        activeSessionIdRef.current = sessionId
        const detail = await subscribe(sessionId)
        activeSessionIdRef.current = null
        closeOverlay()
        return detail
      } catch (err) {
        eventSourceRef.current?.close()
        eventSourceRef.current = null
        activeSessionIdRef.current = null
        closeOverlay()
        throw err
      }
    },
    [resetProgress, subscribe, closeOverlay],
  )

  const cancel = useCallback(() => {
    const sid = activeSessionIdRef.current
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    activeSessionIdRef.current = null
    closeOverlay()
    if (sid) {
      // Server-side abort: tells the worker to skip the next steps
      // and refunds the user's quota slot. Best-effort — local UI
      // state is already in the cancelled state regardless of network
      // outcome.
      void cancelSessionGeneration(sid).catch(() => {
        /* swallow — local state is already cancelled */
      })
    }
    toast.info(t('create.toastGenerationCancelled'))
  }, [closeOverlay, t])

  // Warn the user if they try to close / refresh the tab while a
  // generation is in flight. This complements the persistent overlay
  // by making it harder to accidentally throw away an in-progress run.
  useEffect(() => {
    if (!state.isGenerating) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Some browsers require returnValue to be set for the prompt to
      // appear. The actual string is no longer shown by modern
      // browsers — they show a generic confirmation dialog instead.
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state.isGenerating])

  const value = useMemo<GenerationContextType>(
    () => ({
      ...state,
      runGeneration,
      cancel,
    }),
    [state, runGeneration, cancel],
  )

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  )
}

export function useGeneration(): GenerationContextType {
  const ctx = useContext(GenerationContext)
  if (!ctx) {
    throw new Error('useGeneration must be used inside <GenerationProvider>')
  }
  return ctx
}
