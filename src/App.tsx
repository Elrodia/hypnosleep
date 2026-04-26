import { useEffect, useState, lazy, Suspense, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TabBar, TabId } from './components/TabBar'
import { Header } from './components/Header'
import { HomePage } from './components/pages/HomePage'
import { LibraryPage } from './components/pages/LibraryPage'
import { CreatePage } from './components/pages/CreatePage'
import { ProgressPage } from './components/pages/ProgressPage'
import { ProfilePage } from './components/pages/ProfilePage'
import { LoginPage } from './components/pages/LoginPage'
import { AuthCallbackPage } from './components/pages/AuthCallbackPage'
import { AuthErrorPage } from './components/pages/AuthErrorPage'
import { AdminDebugPage } from './components/pages/AdminDebugPage'

// Lazy-load the marketing landing page so its JS and CSS are not shipped
// with the authenticated app bundle. See lazyWithRetry comment below.
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    const RELOAD_KEY = 'landing-chunk-reloaded'
    const maxAttempts = 3
    let lastError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const mod = await factory()
        try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* ignore */ }
        return mod
      } catch (err) {
        lastError = err
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
        }
      }
    }
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(message)
    if (typeof window !== 'undefined' && isChunkError) {
      try {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY)
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, '1')
          window.location.reload()
          return new Promise<{ default: T }>(() => {})
        }
      } catch { /* ignore */ }
    }
    throw lastError
  })
}

const LandingPage = lazyWithRetry(() =>
  import('./landing/LandingPage').then((m) => ({ default: m.LandingPage })),
)
import { QuizPage } from './components/pages/QuizPage'
import { ResultsPage } from './components/pages/ResultsPage'
import { SplashScreen } from './components/SplashScreen'
import { MiniPlayer } from './components/MiniPlayer'
import { FullScreenPlayer } from './components/FullScreenPlayer'
import { OnboardingCarousel } from './components/OnboardingCarousel'
import { FeedbackModal } from './components/FeedbackModal'
import { PaymentSuccessScreen } from './components/PaymentSuccessScreen'
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext'
import { ToastProvider } from './contexts/ToastContext'
import { toast } from 'sonner'
import { useKV } from '@/hooks/use-kv'
import { useAuth } from '@/lib/auth-context'
import { updateProfile, type UserPreferences } from '@/lib/api-endpoints'

/**
 * Top-level route discriminator based on `window.location.pathname`.
 *
 * We intentionally do not pull in a full SPA router — the app's
 * primary navigation is tab-based and the only URLs we need to
 * recognise are the OAuth and payment callbacks.
 */
type AppRoute = 'app' | 'auth-callback' | 'auth-error' | 'payment-success' | 'admin-debug'

interface AuthErrorParams {
  error: string | null
  reason: string | null
  message: string | null
  rid: string | null
}

function resolveRoute(): AppRoute {
  if (typeof window === 'undefined') return 'app'
  const p = window.location.pathname
  if (p === '/auth/callback') return 'auth-callback'
  if (p === '/auth/error') return 'auth-error'
  if (p === '/upgrade/success' || p === '/payment/success') return 'payment-success'
  if (p === '/admin/debug') return 'admin-debug'
  return 'app'
}

function parseAuthErrorParams(): AuthErrorParams {
  if (typeof window === 'undefined') {
    return { error: null, reason: null, message: null, rid: null }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    error: params.get('error'),
    reason: params.get('reason'),
    message: params.get('message'),
    rid: params.get('rid') ?? params.get('requestId'),
  }
}

/**
 * Reset the URL back to `/` without reloading. Used after we consume
 * a callback route so the user doesn't see it in history / share URLs.
 */
function clearCallbackUrl(): void {
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    /* ignore */
  }
}

function AppContent() {
  const { user, status, refresh, setUser } = useAuth()
  const isLoggedIn = status === 'authenticated'

  const [route, setRoute] = useState<AppRoute>(() => resolveRoute())
  const [authErrorParams] = useState<AuthErrorParams>(() => parseAuthErrorParams())
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showSplash, setShowSplash] = useState(true)

  // Local-only onboarding flags that mirror `user.preferences` once the
  // profile loads. This keeps the landing-page flow usable for anonymous
  // users (where we can't write to the backend yet) while giving signed-in
  // users cross-device persistence.
  const [localOnboarding, setLocalOnboarding] = useKV<boolean>('has-completed-onboarding', false)
  const [localQuiz, setLocalQuiz] = useKV<boolean>('has-completed-quiz', false)

  const hasCompletedOnboarding = isLoggedIn
    ? user?.preferences?.hasCompletedOnboarding ?? false
    : (localOnboarding ?? false)
  const hasCompletedQuiz = isLoggedIn
    ? user?.preferences?.hasCompletedQuiz ?? false
    : (localQuiz ?? false)

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showFullPlayer, setShowFullPlayer] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [quizData, setQuizData] = useKV<{
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  } | null>('quiz-data', null)

  const { player, togglePlayPause, setProgress, showFeedback, setShowFeedback, completedSession, stop } = useAudioPlayer()

  useEffect(() => {
    // Keep the splash screen visible until we know whether the user is
    // authenticated, so we don't flash the landing page for logged-in
    // users while `/api/auth/me` is in flight.
    if (status === 'loading') return

    const timer = setTimeout(() => {
      setShowSplash(false)
      if (!isLoggedIn) return
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true)
      } else if (!hasCompletedQuiz) {
        setShowQuiz(true)
      }
      // Note: the Results page is shown directly by `handleQuizComplete`
      // immediately after the quiz is submitted. We deliberately do NOT
      // re-trigger it from this effect based on the persisted `quizData`,
      // because that would cause an infinite loop: dismissing the results
      // (skip / start session) flips `showResults` back to false, the
      // effect re-runs, and the dismissed screen is shown again.
    }, 2500)

    return () => clearTimeout(timer)
  }, [status, hasCompletedOnboarding, hasCompletedQuiz, isLoggedIn])

  useEffect(() => {
    const handleNavigateToTab = (event: CustomEvent<TabId>) => {
      setActiveTab(event.detail)
    }
    const handleShowPaymentSuccess = () => {
      setRoute('payment-success')
    }

    window.addEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
    window.addEventListener('show-payment-success', handleShowPaymentSuccess)
    return () => {
      window.removeEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
      window.removeEventListener('show-payment-success', handleShowPaymentSuccess)
    }
  }, [])

  // Once auth has resolved on the `/auth/callback` route, clear the
  // URL and transition to the normal app route. This lives in an
  // effect (not inline in render) so the side effects don't fire on
  // every re-render of the callback screen.
  useEffect(() => {
    if (route !== 'auth-callback') return
    if (status === 'loading') return
    clearCallbackUrl()
    setRoute('app')
  }, [route, status])

  // If the browser lands on `/auth/error` but the user is actually
  // already authenticated (e.g. a replayed OAuth callback after a
  // successful sign-in — browser back, prefetch, duplicate-tab race,
  // or a stale one-time code), skip the failure screen and drop them
  // into the app. Without this, a perfectly valid session would still
  // see a "Sign-in failed" page purely because of the replay.
  useEffect(() => {
    if (route !== 'auth-error') return
    if (status !== 'authenticated') return
    clearCallbackUrl()
    setRoute('app')
  }, [route, status])

  const handleExpand = () => setShowFullPlayer(true)
  const handleCloseFullPlayer = () => setShowFullPlayer(false)
  const handleSeek = (newProgress: number) => setProgress(newProgress)

  /**
   * Write the given preference patch to the backend and mirror the
   * change into the in-memory user so the UI reflects it immediately.
   * Falls back to the local useKV flag when the user is anonymous.
   */
  const persistPreferences = async (patch: Partial<UserPreferences>) => {
    if (!isLoggedIn) return
    try {
      const updated = await updateProfile({ preferences: patch })
      setUser(updated)
    } catch (err) {
      // Non-fatal: the local mirror in `useKV` + the flag-through-next-login
      // still keeps the user out of the flow. A surfaced toast would be
      // noisy since the user may not even know they're signed in yet.
      console.warn('Failed to persist onboarding preferences:', err)
    }
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    setLocalOnboarding(true)
    void persistPreferences({ hasCompletedOnboarding: true })
    if (!hasCompletedQuiz) setShowQuiz(true)
  }

  const handleQuizComplete = (data: {
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  }) => {
    setQuizData(data)
    setShowQuiz(false)
    setShowResults(true)
    setLocalQuiz(true)
    // The QuizPage uses kebab-case ids (`before-sleep`) but the backend
    // `preferredTime` enum is snake_case (`before_sleep`). Without this
    // mapping the PATCH fails zod validation with a 400, which also
    // drops the `hasCompletedQuiz` flag — causing the quiz to reappear
    // on every reload.
    const preferredTimeMap: Record<string, UserPreferences['preferredTime']> = {
      'before-sleep': 'before_sleep',
      morning: 'morning',
      breaks: 'breaks',
      anytime: 'anytime',
    }
    void persistPreferences({
      hasCompletedQuiz: true,
      goals: data.selectedGoals,
      preferredTime: preferredTimeMap[data.preferredTime] ?? 'before_sleep',
      defaultDuration: data.sessionDuration,
    })
  }

  const handleStartSession = () => {
    setShowResults(false)
    toast.success('Session starting soon!')
  }

  const handleSkipToApp = () => setShowResults(false)

  const renderPage = () => {
    switch (activeTab) {
      case 'home': return <HomePage />
      case 'library': return <LibraryPage />
      case 'create': return <CreatePage />
      case 'progress': return <ProgressPage />
      case 'profile': return <ProfilePage />
      default: return <HomePage />
    }
  }

  // ── Top-level route branches ────────────────────────────────────
  // These are handled before the auth-state machine below so a signed-out
  // user landing on /auth/callback still sees the proper "signing in"
  // screen rather than the landing page.
  if (route === 'auth-callback') {
    // The transition to the app route (and URL cleanup) is handled by
    // the effect above; while it runs we keep showing the callback
    // screen. Once `status` flips off 'loading', the effect swaps
    // `route` to 'app' and we fall through to the normal render tree.
    return <AuthCallbackPage />
  }

  if (route === 'admin-debug') {
    // Authenticated admins only; the API itself gates access (403 for
    // non-admins), so we just require a signed-in session here.
    if (status === 'loading') {
      return (
        <AnimatePresence>
          <SplashScreen />
        </AnimatePresence>
      )
    }
    if (!isLoggedIn) {
      return <LoginPage />
    }
    return <AdminDebugPage />
  }

  if (route === 'auth-error') {
    // Wait for `/api/auth/me` to resolve before deciding. If we have a
    // valid JWT the effect above will transition us to 'app'; in the
    // meantime show the splash so we don't flash the error screen at a
    // user who is actually signed in.
    if (status === 'loading' || status === 'authenticated') {
      return (
        <AnimatePresence>
          <SplashScreen />
        </AnimatePresence>
      )
    }
    return (
      <AuthErrorPage
        error={authErrorParams.error}
        reason={authErrorParams.reason}
        message={authErrorParams.message}
        requestId={authErrorParams.rid}
        onRetry={() => {
          clearCallbackUrl()
          setRoute('app')
          setShowLogin(true)
        }}
      />
    )
  }

  // Render splash while auth is resolving, then decide.
  if (status === 'loading') {
    return (
      <AnimatePresence>
        <SplashScreen />
      </AnimatePresence>
    )
  }

  if (!showSplash && !isLoggedIn) {
    if (showLogin) return <LoginPage />
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <LandingPage
          onStartTrial={() => setShowLogin(true)}
          onLogin={() => setShowLogin(true)}
        />
      </Suspense>
    )
  }

  const showPaymentSuccess = route === 'payment-success'
  const onPaymentSuccessDone = () => {
    clearCallbackUrl()
    setRoute('app')
    // Refresh the profile so the `plan: 'pro'` flip is reflected.
    void refresh()
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentSuccess && (
          <PaymentSuccessScreen
            onNavigateToCreate={() => {
              onPaymentSuccessDone()
              setActiveTab('create')
            }}
            onNavigateToLibrary={() => {
              onPaymentSuccessDone()
              setActiveTab('library')
            }}
            onAutoRedirect={() => {
              onPaymentSuccessDone()
              setActiveTab('home')
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && !showSplash && (
          <OnboardingCarousel onComplete={handleOnboardingComplete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuiz && !showSplash && !showOnboarding && (
          <QuizPage onComplete={handleQuizComplete} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResults && !showSplash && !showOnboarding && !showQuiz && quizData && (
          <ResultsPage
            selectedGoals={quizData.selectedGoals}
            preferredTime={quizData.preferredTime}
            sessionDuration={quizData.sessionDuration}
            onStartSession={handleStartSession}
            onSkip={handleSkipToApp}
          />
        )}
      </AnimatePresence>

      {!showSplash && !showOnboarding && !showQuiz && !showResults && !showPaymentSuccess && (
        <div className="min-h-screen bg-background text-foreground pb-20 pt-14">
          <Header />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {player.isActive && !showFullPlayer && (
              <MiniPlayer
                isPlaying={player.isPlaying}
                sessionTitle={player.sessionTitle}
                progress={player.progress}
                onPlayPause={togglePlayPause}
                onExpand={handleExpand}
              />
            )}
          </AnimatePresence>

          <FullScreenPlayer
            isOpen={showFullPlayer}
            isPlaying={player.isPlaying}
            sessionTitle={player.sessionTitle}
            category={player.category}
            progress={player.progress}
            duration={player.duration}
            onClose={handleCloseFullPlayer}
            onPlayPause={togglePlayPause}
            onSeek={handleSeek}
            onStop={stop}
          />

          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        sessionTitle={completedSession?.title || ''}
        sessionDuration={completedSession?.duration || 0}
      />
    </>
  )
}

function App() {
  return (
    <ToastProvider>
      <AudioPlayerProvider>
        <AppContent />
      </AudioPlayerProvider>
    </ToastProvider>
  )
}

export default App
