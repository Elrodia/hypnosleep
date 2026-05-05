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
  /**
   * Wall-clock timestamp (ms since epoch) of when the current run was
   * kicked off. Used by the overlay to compute the estimated remaining
   * time. `null` when nothing is running.
   */
  startedAt: number | null
  /**
   * Heuristic total expected duration in seconds for the current run
   * (depends on selected `durationMin`). Used together with
   * `startedAt` to derive a remaining-time hint while the bar is far
   * from 100%. `null` when nothing is running.
   */
  estimatedTotalSec: number | null
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
  // Treat the very first frame as already in the `script` phase so the
  // overlay's "writing your script" row is visually active from the
  // instant the user taps generate. The script is generated
  // *synchronously* inside `POST /api/sessions/generate` (see
  // `createGenerationSession`), so without this seed the user would
  // sit on the "queued" row at 0% for the entire script-generation
  // window — which is exactly the "step 1 is endless" bug.
  step: 'script',
  percent: 0,
  message: 'Writing your script...',
  startedAt: null,
  estimatedTotalSec: null,
}

/**
 * Rough total wall-clock time (in seconds) we expect a generation run
 * to take, keyed by the requested session duration in minutes. These
 * numbers are deliberately generous — overestimating makes the
 * remaining-time hint trustworthy ("~2m 10s" sticking around for an
 * extra few seconds at the very end is far less alarming than a "~5s"
 * hint that lingers for a minute). Values were chosen from observed
 * production p95 generation times.
 */
const ESTIMATED_TOTAL_SEC_BY_MIN: Record<number, number> = {
  5: 90,
  10: 150,
}
const FALLBACK_ESTIMATED_TOTAL_SEC = 120

/**
 * Soft auto-advance of the progress bar during the *script* phase.
 *
 * The backend does not emit any progress events while it's calling
 * Gemini synchronously inside the POST handler — the first real event
 * the SSE stream sees is `script @ 10%` from the worker. Without a
 * client-side creep the bar would freeze at 0% for the entire
 * script-generation window (commonly 20–40s) and feel hung.
 *
 * The creep:
 *  - only runs while `step === 'script'`
 *  - stops the moment `percent >= 9` (so it never overshoots the real
 *    backend's first emission at 10%)
 *  - is instantly overridden by any incoming SSE `progress` event
 */
const SCRIPT_CREEP_TICK_MS = 600
const SCRIPT_CREEP_CAP = 9
const SCRIPT_CREEP_INCREMENT = 0.4

/**
 * Polling cadence for the safety-net fallback that watches the
 * session row directly via `GET /api/sessions/:id`. This catches the
 * "SSE silently died but the worker is still finishing" failure mode
 * that previously left users stranded on the loading screen until
 * they refreshed and discovered the session in the library minutes
 * later.
 */
const SESSION_POLL_INTERVAL_MS = 5_000

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [state, setState] = useState<GenerationState>(INITIAL_STATE)

  // Holds the current SSE EventSource so we can close it on cancel /
  // unmount. Kept in a ref so re-renders don't orphan subscriptions.
  const eventSourceRef = useRef<EventSource | null>(null)
  // Tracks the in-flight session id so `cancel()` can POST to the
  // server-side cancel endpoint, not just close the SSE.
  const activeSessionIdRef = useRef<string | null>(null)
  // Soft script-phase progress creep. See SCRIPT_CREEP_* constants.
  const scriptCreepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Safety-net polling on `GET /api/sessions/:id`. Closes the overlay
  // when the backend marks the session ready / failed even if the SSE
  // stream silently dropped (e.g. proxy idle timeout, client-side
  // network blip).
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopScriptCreep = useCallback(() => {
    if (scriptCreepIntervalRef.current) {
      clearInterval(scriptCreepIntervalRef.current)
      scriptCreepIntervalRef.current = null
    }
  }, [])

  const stopSessionPoll = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  // Defensive cleanup: if the provider ever unmounts (only happens on
  // a full app teardown) make sure no SSE / interval is left dangling.
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      stopScriptCreep()
      stopSessionPoll()
    }
  }, [stopScriptCreep, stopSessionPoll])

  const startScriptCreep = useCallback(() => {
    stopScriptCreep()
    scriptCreepIntervalRef.current = setInterval(() => {
      setState((prev) => {
        // Only advance during the script phase, never past the cap, and
        // never when nothing is running.
        if (!prev.isGenerating || prev.step !== 'script' || prev.percent >= SCRIPT_CREEP_CAP) {
          return prev
        }
        const next = Math.min(SCRIPT_CREEP_CAP, prev.percent + SCRIPT_CREEP_INCREMENT)
        return { ...prev, percent: next }
      })
    }, SCRIPT_CREEP_TICK_MS)
  }, [stopScriptCreep])

  const resetProgress = useCallback(
    (durationMin: number) => {
      const total =
        ESTIMATED_TOTAL_SEC_BY_MIN[durationMin] ?? FALLBACK_ESTIMATED_TOTAL_SEC
      setState({
        isGenerating: true,
        // See INITIAL_STATE comment — starting in `script` (not
        // `queued`) is what makes the overlay's first row light up
        // immediately, eliminating the "step 1 is endless" feel.
        step: 'script',
        percent: 0,
        message: 'Writing your script...',
        startedAt: Date.now(),
        estimatedTotalSec: total,
      })
    },
    [],
  )

  const closeOverlay = useCallback(() => {
    stopScriptCreep()
    stopSessionPoll()
    setState((s) => ({
      ...s,
      isGenerating: false,
      startedAt: null,
      estimatedTotalSec: null,
    }))
  }, [stopScriptCreep, stopSessionPoll])

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
          stopScriptCreep()
          stopSessionPoll()
          fn()
        }

        // Safety-net poller: every few seconds, ask the API for the
        // session row directly. If the worker has flipped the row to
        // `ready` / `failed` but our SSE somehow missed the terminal
        // event (proxy idle timeout, mobile background tab, etc.) we
        // still settle the run cleanly instead of leaving the overlay
        // open until the user manually refreshes.
        pollIntervalRef.current = setInterval(() => {
          if (settled) return
          getSession(sessionId)
            .then((detail) => {
              if (settled) return
              if (detail.status === 'ready') {
                done(() => resolve(detail))
              } else if (detail.status === 'failed') {
                done(() => reject(new Error('Generation failed')))
              }
              // 'generating' / 'draft' → keep waiting on SSE.
            })
            .catch(() => {
              // Transient API errors are non-fatal — the next tick will
              // try again. We never want a failed poll to abort an
              // otherwise-healthy run.
            })
        }, SESSION_POLL_INTERVAL_MS)

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

          setState((prev) => {
            const nextStep =
              typeof payload.step === 'string' ? payload.step : prev.step
            // Once we've left the script phase the soft creep must
            // stop — real backend percentages take over.
            if (nextStep !== 'script' && scriptCreepIntervalRef.current) {
              stopScriptCreep()
            }
            // Never let the bar go *backwards*: the backend's first
            // tick is `script @ 10%` but our local creep may already
            // have nudged us to ~8%, which is fine; what we want to
            // avoid is e.g. a stale `queued @ 0%` event clobbering an
            // 8% creep value.
            const incomingPercent =
              typeof payload.progress === 'number' ? payload.progress : prev.percent
            const nextPercent =
              nextStep === prev.step
                ? Math.max(prev.percent, incomingPercent)
                : incomingPercent
            return {
              ...prev,
              isGenerating: true,
              step: nextStep,
              percent: nextPercent,
              message:
                typeof payload.message === 'string' ? payload.message : prev.message,
            }
          })

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
          // Don't reject on transient connection blips — `EventSource`
          // auto-reconnects with backoff while `readyState` is
          // CONNECTING, and the safety-net poller above will still
          // settle the run if the worker finishes during a reconnect.
          // Only treat a fully-closed stream (server returned a
          // non-2xx, etc.) as terminal here; even then we *don't*
          // reject — we keep the overlay open and rely entirely on the
          // poller to detect ready/failed. This matches the user's
          // observation that "the session appears in the library a
          // few minutes later" even after the streaming connection
          // dies.
          if (es.readyState === EventSource.CLOSED) {
            // Drop the dead EventSource so we don't leak it, but keep
            // the run alive — `pollIntervalRef` will resolve/reject
            // once the backend writes a terminal status.
            if (eventSourceRef.current === es) {
              eventSourceRef.current = null
            }
          }
        }
      }),
    [stopScriptCreep, stopSessionPoll],
  )

  const runGeneration = useCallback(
    async (input: GenerateSessionInput): Promise<SessionDetail> => {
      // If something is already running, refuse to start another run
      // rather than orphaning the previous SSE.
      if (eventSourceRef.current) {
        throw new Error('A generation is already in progress')
      }
      resetProgress(input.durationMin)
      // Start the soft creep *before* awaiting the POST: script
      // generation runs synchronously inside the POST handler, so
      // this is precisely the window during which we have no real
      // backend progress to display.
      startScriptCreep()
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
    [resetProgress, startScriptCreep, subscribe, closeOverlay],
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
