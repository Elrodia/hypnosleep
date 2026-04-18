import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { GoogleLogo, GithubLogo, MicrosoftOutlookLogo } from '@phosphor-icons/react'
import { startOAuth } from '@/lib/auth'

export function LoginPage() {
  const handleGoogleLogin = () => {
    startOAuth('google')
  }

  const handleGithubLogin = () => {
    startOAuth('github')
  }

  const handleMicrosoftLogin = () => {
    startOAuth('microsoft')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-5xl mb-4"
          >
            🌙
          </motion.div>
          <h1 className="font-serif text-3xl font-semibold text-foreground">
            Welcome to HypnoSleep
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to start your journey to better sleep
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleGoogleLogin}
            className="w-full h-12 bg-gradient-to-r from-primary via-[oklch(0.62_0.19_285)] to-[oklch(0.55_0.17_285)] hover:from-[oklch(0.62_0.19_285)] hover:via-[oklch(0.66_0.20_285)] hover:to-[oklch(0.58_0.18_285)] text-white shadow-lg shadow-primary/30 transition-all duration-300"
          >
            <GoogleLogo className="mr-3" size={20} weight="regular" />
            Continue with Google
          </Button>

          <Button
            onClick={handleGithubLogin}
            className="w-full h-12 bg-gradient-to-r from-primary via-[oklch(0.62_0.19_285)] to-[oklch(0.55_0.17_285)] hover:from-[oklch(0.62_0.19_285)] hover:via-[oklch(0.66_0.20_285)] hover:to-[oklch(0.58_0.18_285)] text-white shadow-lg shadow-primary/30 transition-all duration-300"
          >
            <GithubLogo className="mr-3" size={20} weight="regular" />
            Continue with GitHub
          </Button>

          <Button
            onClick={handleMicrosoftLogin}
            className="w-full h-12 bg-gradient-to-r from-primary via-[oklch(0.62_0.19_285)] to-[oklch(0.55_0.17_285)] hover:from-[oklch(0.62_0.19_285)] hover:via-[oklch(0.66_0.20_285)] hover:to-[oklch(0.58_0.18_285)] text-white shadow-lg shadow-primary/30 transition-all duration-300"
          >
            <MicrosoftOutlookLogo className="mr-3" size={20} weight="regular" />
            Continue with Microsoft
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  )
}
