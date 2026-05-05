import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { CircleNotch } from '@phosphor-icons/react'
import { consumeOAuthCallback } from '@/lib/auth'
import { useAuth } from '@/lib/auth-context'

/**
 * Landing page for `${FRONTEND_URL}/auth/callback?token=<JWT>`.
 *
 * The OAuth backend issues a redirect here after a successful
 * handshake. We:
 *   1. Pull `?token=` out of the URL and persist it (idempotent — the
 *      AuthProvider may already have done this on its own mount).
 *   2. Call `refresh()` so the user's profile is loaded before the
 *      app shell mounts.
 *   3. Show a calm "signing you in…" UI the whole time instead of
 *      briefly flashing the landing page like the old
 *      `consumeOAuthCallback`-inside-`App.tsx` flow did.
 *
 * Rendered as a top-level branch from `App.tsx` when the current
 * pathname is `/auth/callback`.
 */
export function AuthCallbackPage() {
  const { t } = useTranslation()
  const { refresh } = useAuth()
  const [tokenOk] = useState(() => consumeOAuthCallback())

  useEffect(() => {
    // Always refresh, even if `consumeOAuthCallback` returned false —
    // the AuthProvider may have already consumed the token on mount.
    void refresh()
  }, [refresh])

  return (
    <div className="ls-auth-callback min-h-screen flex items-center justify-center bg-[var(--ls-bg)] text-[var(--ls-text)] px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 text-center max-w-sm"
      >
        <CircleNotch
          size={40}
          weight="regular"
          className="text-[var(--ls-sand-dim)] animate-spin"
        />
        <div className="space-y-2">
          <h1 className="font-fraunces italic lowercase text-2xl text-[var(--ls-text)]">
            {t('authCallback.title')}
          </h1>
          <p className="text-sm text-[var(--ls-text-muted)] lowercase">
            {tokenOk
              ? t('authCallback.subtitleOk')
              : t('authCallback.subtitleChecking')}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
