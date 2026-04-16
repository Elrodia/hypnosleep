import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TabBar, TabId } from './components/TabBar'
import { Header } from './components/Header'
import { HomePage } from './components/pages/HomePage'
import { LibraryPage } from './components/pages/LibraryPage'
import { CreatePage } from './components/pages/CreatePage'
import { ProgressPage } from './components/pages/ProgressPage'
import { ProfilePage } from './components/pages/ProfilePage'
import { LoginPage } from './components/pages/LoginPage'
import { QuizPage } from './components/pages/QuizPage'
import { ResultsPage } from './components/pages/ResultsPage'
import { SplashScreen } from './components/SplashScreen'
import { MiniPlayer } from './components/MiniPlayer'
import { FullScreenPlayer } from './components/FullScreenPlayer'
import { OnboardingCarousel } from './components/OnboardingCarousel'
import { FeedbackModal } from './components/FeedbackModal'
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext'
import { ToastProvider } from './contexts/ToastContext'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showSplash, setShowSplash] = useState(true)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('has-completed-onboarding', false)
  const [hasCompletedQuiz, setHasCompletedQuiz] = useKV<boolean>('has-completed-quiz', false)
  const [isLoggedIn, setIsLoggedIn] = useKV<boolean>('is-logged-in', false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showFullPlayer, setShowFullPlayer] = useState(false)
  const [quizData, setQuizData] = useKV<{
    selectedGoals: string[]
    preferredTime: string
    sessionDuration: number
  } | null>('quiz-data', null)
  const { player, togglePlayPause, setProgress, showFeedback, setShowFeedback, completedSession, stop } = useAudioPlayer()

  useEffect(() => {
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
  }, [hasCompletedOnboarding, hasCompletedQuiz, isLoggedIn, quizData, showResults])

  useEffect(() => {
    const handleNavigateToTab = (event: CustomEvent<TabId>) => {
      setActiveTab(event.detail)
    }

    window.addEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
    return () => {
      window.removeEventListener('navigate-to-tab', handleNavigateToTab as EventListener)
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

  const handleLogin = () => {
    setIsLoggedIn(true)
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true)
    } else if (!hasCompletedQuiz) {
      setShowQuiz(true)
    }
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
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen />}
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
      
      {!showSplash && !showOnboarding && !showQuiz && !showResults && (
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