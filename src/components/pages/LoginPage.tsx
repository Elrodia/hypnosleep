import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleLogo, GithubLogo, MicrosoftOutlookLogo, EnvelopeSimple, ArrowLeft } from '@phosphor-icons/react'
import { canUseOAuthBrowserState, startOAuth, sendEmailOtp, verifyEmailOtp, type OAuthProvider } from '@/lib/auth'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

type EmailStep = 'idle' | 'input' | 'otp' | 'sending' | 'verifying'

export function LoginPage() {
  const { refresh } = useAuth()
  const [emailStep, setEmailStep] = useState<EmailStep>('idle')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const handleOAuthLogin = (provider: OAuthProvider) => {
    if (!canUseOAuthBrowserState()) {
      toast.error(
        'OAuth login requires cookies and browser storage. Please allow cookies and disable strict anti-tracking protection, then try again.'
      )
      return
    }

    startOAuth(provider)
  }

  const handleGoogleLogin = () => {
    handleOAuthLogin('google')
  }

  const handleGithubLogin = () => {
    handleOAuthLogin('github')
  }

  const handleMicrosoftLogin = () => {
    handleOAuthLogin('microsoft')
  }

  const handleEmailContinue = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setEmailStep('sending')
    try {
      await sendEmailOtp(trimmed)
      setEmail(trimmed)
      setEmailStep('otp')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send sign-in code. Please try again.')
      setEmailStep('input')
    }
  }

  const handleOtpVerify = async () => {
    if (!otp.trim()) {
      toast.error('Please enter the 6-digit code.')
      return
    }
    setEmailStep('verifying')
    try {
      const ok = await verifyEmailOtp(email, otp.trim())
      if (ok) {
        await refresh()
      } else {
        toast.error('Invalid or expired code. Please try again.')
        setEmailStep('otp')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed. Please try again.')
      setEmailStep('otp')
    }
  }

  const handleBackToOAuth = () => {
    setEmailStep('idle')
    setEmail('')
    setOtp('')
  }

  const handleBackToEmail = () => {
    setEmailStep('input')
    setOtp('')
  }

  const isEmailInputStep = emailStep === 'input' || emailStep === 'sending'
  const isOtpStep = emailStep === 'otp' || emailStep === 'verifying'

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

        <AnimatePresence mode="wait">
          {emailStep === 'idle' && (
            <motion.div
              key="oauth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
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

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                onClick={() => setEmailStep('input')}
                variant="outline"
                className="w-full h-12"
              >
                <EnvelopeSimple className="mr-3" size={20} />
                Continue with Email
              </Button>
            </motion.div>
          )}

          {isEmailInputStep && (
            <motion.div
              key="email-input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <button
                onClick={handleBackToOAuth}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a 6-digit sign-in code.
              </p>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleEmailContinue() }}
                disabled={emailStep === 'sending'}
                autoFocus
              />
              <Button
                onClick={() => void handleEmailContinue()}
                disabled={emailStep === 'sending'}
                className="w-full h-12 bg-gradient-to-r from-primary via-[oklch(0.62_0.19_285)] to-[oklch(0.55_0.17_285)] hover:from-[oklch(0.62_0.19_285)] hover:via-[oklch(0.66_0.20_285)] hover:to-[oklch(0.58_0.18_285)] text-white shadow-lg shadow-primary/30 transition-all duration-300"
              >
                {emailStep === 'sending' ? 'Sending…' : 'Send Code'}
              </Button>
            </motion.div>
          )}

          {isOtpStep && (
            <motion.div
              key="otp-input"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <button
                onClick={handleBackToEmail}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>. Enter it below.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleOtpVerify() }}
                disabled={emailStep === 'verifying'}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              <Button
                onClick={() => void handleOtpVerify()}
                disabled={emailStep === 'verifying'}
                className="w-full h-12 bg-gradient-to-r from-primary via-[oklch(0.62_0.19_285)] to-[oklch(0.55_0.17_285)] hover:from-[oklch(0.62_0.19_285)] hover:via-[oklch(0.66_0.20_285)] hover:to-[oklch(0.58_0.18_285)] text-white shadow-lg shadow-primary/30 transition-all duration-300"
              >
                {emailStep === 'verifying' ? 'Verifying…' : 'Verify Code'}
              </Button>
              <button
                onClick={() => void handleEmailContinue()}
                disabled={emailStep === 'verifying'}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Resend code
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  )
}

