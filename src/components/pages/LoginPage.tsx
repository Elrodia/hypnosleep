import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GoogleLogo, GithubLogo, MicrosoftOutlookLogo } from '@phosphor-icons/react'
import { Logo } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { canUseOAuthBrowserState, startOAuth, type OAuthProvider } from '@/lib/auth'
import { toast } from 'sonner'

export function LoginPage() {
  const { t } = useTranslation()
  const handleOAuthLogin = (provider: OAuthProvider) => {
    if (!canUseOAuthBrowserState()) {
      toast.error(t('login.errorCookies'))
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
            {t('login.title')}
          </h1>
          <p className="text-sm text-[var(--ls-text-muted)] lowercase">
            {t('login.subtitle')}
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
            <span>{t('login.google')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('github')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-sm lowercase"
          >
            <GithubLogo size={18} weight="regular" />
            <span>{t('login.github')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuthLogin('microsoft')}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-sm lowercase"
          >
            <MicrosoftOutlookLogo size={18} weight="regular" />
            <span>{t('login.microsoft')}</span>
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="text-center pt-2">
          <p className="text-xs text-[var(--ls-text-subtle)] lowercase">
            {t('login.footerTerms')}
          </p>
        </div>

        {/* ── Language switcher ──
            Placed below the terms footer so it's available without
            competing visually with the OAuth buttons (the primary
            action). */}
        <div className="flex justify-center pt-4">
          <LanguageSwitcher variant="compact" />
        </div>
      </motion.div>
    </div>
  )
}
