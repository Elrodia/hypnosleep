import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TabBar, TabId } from './components/TabBar'
import { Header } from './components/Header'
import { HomePage } from './components/pages/HomePage'
import { LibraryPage } from './components/pages/LibraryPage'
import { CreatePage } from './components/pages/CreatePage'
import { ProgressPage } from './components/pages/ProgressPage'
import { ProfilePage } from './components/pages/ProfilePage'
import { LoginPage } from './components/pages/LoginPage'
// Lazy-load the marketing landing page so its JS and CSS are not shipped
// with the authenticated app bundle.
//
// Dynamically imported chunks are emitted with content-hashed filenames
// (e.g. `LandingPage-BgsnaQ-Z.js`). When a new version of the app is
// deployed, any tab still running the previous version will request a
// chunk filename that no longer exists on the server, producing a
// "Failed to fetch dynamically imported module" error. To recover
// gracefully we retry the import a few times and, if it still
// fails, force a one-shot hard reload so the user picks up the latest
// build instead of being stuck on the error fallback.
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
        // Successfully loaded; clear any stale reload flag.
        try {
          sessionStorage.removeItem(RELOAD_KEY)
        } catch {
          /* ignore storage errors */
        }
        return mod
      } catch (err) {
        lastError = err
        // Brief backoff before retrying transient network failures.
        // Skip the backoff after the final attempt so we don't add an
        // unnecessary delay before the reload / error path.
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
        }
      }
    }

    // All retries failed. If this looks like a stale chunk error and we
    // haven't already attempted a reload, hard-refresh once.
    const message = lastError instanceof Error ? lastError.message : String(lastError)
    const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(message)
    if (typeof window !== 'undefined' && isChunkError) {
      try {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY)
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, '1')
          window.location.reload()
          // Return a never-resolving promise so React keeps the Suspense
          // fallback visible until the reload happens.
          return new Promise<{ default: T }>(() => {})
        }
      } catch {
        /* ignore storage errors */
      }
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
import { useKV } from '@github/spark/hooks'
import {
  consumeOAuthCallback,
  consumeOAuthError,
  fetchCurrentUser,
  type AuthUser,
} from './lib/auth'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showSplash, setShowSplash] = useState(true)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('has-completed-onboarding', false)
  const [hasCompletedQuiz, setHasCompletedQuiz] = useKV<boolean>('has-completed-quiz', false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [, setCurrentUser] = useState<AuthUser | null>(null)
  const isLoggedIn = authStatus === 'authenticated'
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showFullPlayer, setShowFullPlayer] = useState(false)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [quizData, setQuizData] = useKV<{
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  } | null>('quiz-data', null)
  const { player, togglePlayPause, setProgress, showFeedback, setShowFeedback, completedSession, stop } = useAudioPlayer()

  // Resolve auth state on mount: handle the OAuth callback redirect,
  // then ask the backend who we are. This replaces the Spark KV
  // `is-logged-in` flag that 404s in production.
  useEffect(() => {
    let cancelled = false

    if (consumeOAuthError()) {
      toast.error('Sign-in failed. Please try again.')
    } else {
      consumeOAuthCallback()
    }

    void fetchCurrentUser().then((user) => {
      if (cancelled) return
      if (user) {
        setCurrentUser(user)
        setAuthStatus('authenticated')
      } else {
        setCurrentUser(null)
        setAuthStatus('unauthenticated')
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Keep the splash screen visible until we know whether the user is
    // authenticated, so we don't flash the landing page for logged-in
    // users while `/api/auth/me` is in flight.
    if (authStatus === 'loading') {
      return
    }

    const timer = setTimeout(() => {
      setShowSplash(false)
      if (!isLoggedIn) {
        return
      }
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true)
      } else if (!hasCompletedQuiz) {
        setShowQuiz(true)
      } else if (quizData && !showResults) {
        setShowResults(true)
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [authStatus, hasCompletedOnboarding, hasCompletedQuiz, isLoggedIn, quizData, showResults])

  useEffect(() => {
    const handleNavigateToTab = (event: CustomEvent<TabId>) => {
      setActiveTab(event.detail)
    }

    const handleShowPaymentSuccess = () => {
      setShowPaymentSuccess(true)
    }

    window.addEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
    window.addEventListener('show-payment-success', handleShowPaymentSuccess)
    return () => {
      window.removeEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
      window.removeEventListener('show-payment-success', handleShowPaymentSuccess)
    }
  }, [])

  const handleExpand = () => {
    setShowFullPlayer(true)
  }

  const handleCloseFullPlayer = () => {
    setShowFullPlayer(false)
  }

  const handleSeek = (newProgress: number) => {
    setProgress(newProgress)
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    setHasCompletedOnboarding(true)
    if (!hasCompletedQuiz) {
      setShowQuiz(true)
    }
  }

  const handleQuizComplete = (data: {
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  }) => {
    setQuizData(data)
    setShowQuiz(false)
    setShowResults(true)
    setHasCompletedQuiz(true)
  }

  const handleStartSession = () => {
    setShowResults(false)
    toast.success('Session starting soon!')
  }

  const handleSkipToApp = () => {
    setShowResults(false)
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage />
      case 'library':
        return <LibraryPage />
      case 'create':
        return <CreatePage />
      case 'progress':
        return <ProgressPage />
      case 'profile':
        return <ProfilePage />
      default:
        return <HomePage />
    }
  }

  if (!showSplash && !isLoggedIn) {
    if (showLogin) {
      return <LoginPage />
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <LandingPage
          onStartTrial={() => setShowLogin(true)}
          onLogin={() => setShowLogin(true)}
        />
      </Suspense>
    )
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
              setShowPaymentSuccess(false)
              setActiveTab('create')
            }}
            onNavigateToLibrary={() => {
              setShowPaymentSuccess(false)
              setActiveTab('library')
            }}
            onAutoRedirect={() => {
              setShowPaymentSuccess(false)
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