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
import { SplashScreen } from './components/SplashScreen'
import { MiniPlayer } from './components/MiniPlayer'
import { OnboardingCarousel } from './components/OnboardingCarousel'
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext'
import { ToastProvider } from './contexts/ToastContext'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [showSplash, setShowSplash] = useState(true)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useKV<boolean>('has-completed-onboarding', false)
  const [isLoggedIn, setIsLoggedIn] = useKV<boolean>('is-logged-in', false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const { player, togglePlayPause } = useAudioPlayer()

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false)
      if (!isLoggedIn) {
        return
      }
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true)
      }
    }, 2500)

    return () => clearTimeout(timer)
  }, [hasCompletedOnboarding, isLoggedIn])

  const handleExpand = () => {
    toast.info('Full player view coming soon!')
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    setHasCompletedOnboarding(true)
  }

  const handleLogin = () => {
    setIsLoggedIn(true)
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true)
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
      
      {!showSplash && !showOnboarding && (
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
            {player.isActive && (
              <MiniPlayer
                isPlaying={player.isPlaying}
                sessionTitle={player.sessionTitle}
                progress={player.progress}
                onPlayPause={togglePlayPause}
                onExpand={handleExpand}
              />
            )}
          </AnimatePresence>
          
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      )}
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