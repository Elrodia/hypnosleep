import { motion } from 'framer-motion'
import { GoogleLogo, GithubLogo, MicrosoftOutlookLogo } from '@phosphor-icons/react'
import { Logo } from '@/components/Logo'
import { canUseOAuthBrowserState, startOAuth, type OAuthProvider } from '@/lib/auth'
import { toast } from 'sonner'

export function LoginPage() {
  const handleOAuthLogin = (provider: OAuthProvider) => {
    if (!canUseOAuthBrowserState()) {
      toast.error(
        'oauth login requires cookies and browser storage. please allow cookies and disable strict anti-tracking protection, then try again.'
      )
      return
    }
    startOAuth(provider)
  }

  return (
    <div className="ls-login min-h-screen flex items-center justify-center px-6 pb-20 bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm space-y-10"
      >
        {/* ── Brand block ── */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <Logo variant="mark" size={56} alt="" className="rounded-xl" />
          </motion.div>
          <h1 className="font-fraunces italic lowercase text-3xl text-[var(--ls-text)]">
            welcome.
          </h1>
          <p className="text-sm text-[var(--ls-text-muted)] lowercase">
            sign in to begin.
          </p>
        </div>

        {/* ── OAuth buttons ── */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-sm lowercase"
          >
            <GoogleLogo size={18} weight="regular" />
            <span>continue with google</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('github')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-sm lowercase"
          >
            <GithubLogo size={18} weight="regular" />
            <span>continue with github</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('microsoft')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-sm lowercase"
          >
            <MicrosoftOutlookLogo size={18} weight="regular" />
            <span>continue with microsoft</span>
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2">
          <p className="text-xs text-[var(--ls-text-subtle)] lowercase">
            by continuing, you agree to our terms and privacy policy.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
