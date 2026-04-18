import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
 *   3. Show a proper "Signing you in…" UI the whole time instead of
 *      briefly flashing the landing page like the old
 *      `consumeOAuthCallback`-inside-`App.tsx` flow did.
 *
 * Rendered as a top-level branch from `App.tsx` when the current
 * pathname is `/auth/callback`.
 */
export function AuthCallbackPage() {
  const { refresh } = useAuth()
  const [tokenOk] = useState(() => consumeOAuthCallback())

  useEffect(() => {
    // Always refresh, even if `consumeOAuthCallback` returned false —
    // the AuthProvider may have already consumed the token on mount.
    void refresh()
  }, [refresh])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 text-center max-w-sm"
      >
        <CircleNotch
          size={48}
          weight="bold"
          className="text-primary animate-spin"
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-semibold">Signing you in…</h1>
          <p className="text-sm text-muted-foreground">
            {tokenOk
              ? 'Finishing up your sign-in, one moment.'
              : 'Checking your session — hold tight.'}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
