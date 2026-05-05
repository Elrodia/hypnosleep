import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Play, ArrowRight } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { listSessions, type SessionSummary } from '@/lib/api-endpoints'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { useAuth } from '@/lib/auth-context'

/**
 * Tonight — the app's primary decision surface.
 *
 * Replaces the legacy Progress tab. Answers exactly one question:
 * what should the user play right now? The recommendation is
 * computed entirely client-side from local time + the most recent
 * sessions returned by `GET /api/sessions?sort=newest`.
 *
 * The resume branch from the design spec is intentionally dropped
 * here: `useKV` in this codebase persists to the backend, not to
 * `localStorage`, and the player does not currently write a
 * `player-last-session-id` / `session-progress-*` signal. Adding
 * that persistence is out of scope for this page, so we fall back
 * to the time-of-day branch.
 */

// Liminal `--ls-*` tokens are page-local (not defined on :root), so this
// component must declare them itself or none of the `var(--ls-*)`
// utilities — including `hover:bg-[var(--ls-bg-elevated)]/40`, the
// `group-hover` ring colours, and the Fraunces font — will resolve.
// `active:` mirrors the hover treatment so mobile (touch) users get the
// same press feedback desktop users get on hover.
const STYLES = `
.ls-tonight {
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
  -webkit-tap-highlight-color: transparent;
}
.ls-tonight .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

type Recommendation =
  | {
      kind: 'time-based'
      title: string
      subtitle: string
      sessionId: string
      ctaLabel: string
    }
  | {
      kind: 'create'
      title: string
      subtitle: string
      sessionId: null
      ctaLabel: string
    }

export function TonightPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { play } = useAudioPlayer()

  const { data: recentEnvelope } = useQuery({
    queryKey: ['sessions', 'recent', 5],
    queryFn: () => listSessions({ limit: 5, sort: 'newest' }),
  })

  // Use a stable "now" frozen at first render so the recommendation
  // doesn't flicker if React re-renders during a tab switch.
  const recommendation = useMemo<Recommendation>(() => {
    const now = new Date()
    const recent = recentEnvelope?.data ?? []
    return pickRecommendation({ now, recentSessions: recent, t })
  }, [recentEnvelope, t])

  const playAgain = useMemo<SessionSummary[]>(() => {
    const items = recentEnvelope?.data ?? []
    // Filter out the one we're recommending (avoid duplicate),
    // keep the next three.
    return items.filter((s) => s.id !== recommendation.sessionId).slice(0, 3)
  }, [recentEnvelope, recommendation])

  const isFirstNight = (recentEnvelope?.data ?? []).length === 0

  const firstName = user?.name?.split(' ')[0]?.toLowerCase()

  const handlePrimary = () => {
    if (recommendation.kind === 'create') {
      window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'create' }))
      return
    }
    if (recommendation.sessionId) {
      const session = (recentEnvelope?.data ?? []).find(
        (s) => s.id === recommendation.sessionId,
      )
      if (session) {
        play({
          sessionId: session.id,
          title: session.title,
          category: session.category,
          duration: session.durationSec,
        })
      }
    }
  }

  return (
    <div className="ls-tonight min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>
      <div className="mx-auto max-w-xl px-6 pt-12 pb-24 space-y-12">

        {/* === GREETING === */}
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
            {t('tabBar.tonight')}
          </p>
          <h1 className="font-fraunces italic lowercase text-4xl text-[var(--ls-text)]">
            {firstName
              ? t('tonight.greeting', { name: firstName })
              : t('tonight.greetingAnonymous')}
          </h1>
        </header>

        {/* === HERO RECOMMENDATION === */}
        {!isFirstNight && (
          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-[var(--ls-text-muted)] lowercase">
                {recommendation.title}
              </p>
              <p className="font-fraunces italic text-2xl text-[var(--ls-text)] lowercase leading-tight">
                {recommendation.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={handlePrimary}
              className="w-full h-14 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 active:bg-[var(--ls-sand)]/80 active:scale-[0.99] transition-[background-color,transform] font-fraunces italic lowercase text-lg flex items-center justify-center gap-3"
            >
              {recommendation.kind === 'create' ? (
                <>
                  <ArrowRight weight="regular" className="w-5 h-5" />
                  {recommendation.ctaLabel}
                </>
              ) : (
                <>
                  <Play weight="fill" className="w-5 h-5" />
                  {recommendation.ctaLabel}
                </>
              )}
            </button>
          </section>
        )}

        {/* === FIRST-NIGHT EMPTY STATE === */}
        {isFirstNight && (
          <section className="space-y-6 py-8">
            <div className="space-y-2">
              <p className="font-fraunces italic text-2xl text-[var(--ls-text)] lowercase leading-snug">
                {t('tonight.heroEmpty')}
              </p>
              <p className="text-sm text-[var(--ls-text-muted)]">
                {t('tonight.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('navigate-to-tab', { detail: 'create' }),
                )
              }
              className="w-full h-14 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 active:bg-[var(--ls-sand)]/80 active:scale-[0.99] transition-[background-color,transform] font-fraunces italic lowercase text-lg flex items-center justify-center gap-3"
            >
              <ArrowRight weight="regular" className="w-5 h-5" />
              {t('tonight.createCta')}
            </button>
          </section>
        )}

        {/* === PLAY AGAIN === */}
        {playAgain.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-[var(--ls-border)]">
            <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              {t('tonight.againTitle')}
            </h2>
            <div className="space-y-px">
              {playAgain.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() =>
                    play({
                      sessionId: session.id,
                      title: session.title,
                      category: session.category,
                      duration: session.durationSec,
                    })
                  }
                  className="w-full flex items-center justify-between py-4 border-b border-[var(--ls-border)] hover:bg-[var(--ls-bg-elevated)]/40 active:bg-[var(--ls-bg-elevated)]/70 transition-colors group text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-[var(--ls-text)] lowercase truncate">
                      {session.title.toLowerCase()}
                    </p>
                    <p className="text-xs text-[var(--ls-text-subtle)] uppercase tracking-widest mt-0.5">
                      {session.category} · {Math.round(session.durationSec / 60)} min
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-full border border-[var(--ls-border-strong)] group-hover:border-[var(--ls-sand-dim)] group-active:border-[var(--ls-sand)] flex items-center justify-center text-[var(--ls-text-muted)] group-hover:text-[var(--ls-sand)] group-active:text-[var(--ls-sand)] transition-colors flex-shrink-0">
                    <Play weight="fill" className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

// ───── helpers ─────

type TFunc = ReturnType<typeof useTranslation>['t']

function pickTimeContext(
  hour: number,
): 'wind-down' | 'fall-asleep' | 'back-to-sleep' {
  if (hour >= 2 && hour < 5) return 'back-to-sleep'
  if (hour >= 21 || hour < 2) return 'fall-asleep'
  return 'wind-down'
}

function pickRecommendation(opts: {
  now: Date
  recentSessions: SessionSummary[]
  t: TFunc
}): Recommendation {
  const hour = opts.now.getHours()
  const ctx = pickTimeContext(hour)
  const wantedCats: readonly string[] =
    ctx === 'wind-down' ? ['confidence', 'fears', 'focus'] : ['sleep']
  const match = opts.recentSessions.find((s) => wantedCats.includes(s.category))

  if (match) {
    return {
      kind: 'time-based',
      title: opts.t('tonight.heroTitle'),
      subtitle: match.title.toLowerCase(),
      sessionId: match.id,
      ctaLabel: opts.t('tonight.heroPlay'),
    }
  }

  return {
    kind: 'create',
    title: opts.t('tonight.heroTitle'),
    subtitle: opts.t('tonight.heroEmpty'),
    sessionId: null,
    ctaLabel: opts.t('tonight.createCta'),
  }
}
