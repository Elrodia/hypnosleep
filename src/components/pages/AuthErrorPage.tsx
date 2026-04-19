import { motion } from 'framer-motion'
import { WarningCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

interface AuthErrorPageProps {
  /** Called when the user clicks "Try again" — typically clears the
   * URL and routes back to the landing / login page. */
  onRetry: () => void
  error?: string | null
  reason?: string | null
  message?: string | null
  requestId?: string | null
}

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? ''
const REASON_MESSAGES: Record<string, string> = {
  state_missing: 'Your sign-in session is missing required verification data. Please restart sign-in.',
  state_mismatch: 'Your sign-in verification did not match this browser session. Please try again.',
  provider_error: 'The sign-in provider returned an error before authentication completed. Please retry.',
  email_provider_mismatch:
    'This email is already linked to a different sign-in provider. Use the original provider for this account.',
  rate_limited: 'Too many sign-in attempts were detected. Please wait a moment and try again.',
  callback_failed: 'The sign-in callback failed unexpectedly. Please retry in a moment.',
}

function resolveAuthErrorMessage({
  error,
  reason,
  message,
}: Pick<AuthErrorPageProps, 'error' | 'reason' | 'message'>): string {
  const rawReason = normalize(reason)
  const rawError = normalize(error)
  const rawMessage = message?.trim()

  if (rawReason in REASON_MESSAGES) {
    return REASON_MESSAGES[rawReason]
  }

  if (rawReason.includes('cookie') || rawError.includes('cookie')) {
    return 'Your browser appears to be blocking sign-in cookies. Please allow cookies for this site and try again.'
  }
  if (
    rawReason.includes('session') ||
    rawReason.includes('expired') ||
    rawError.includes('session') ||
    rawError.includes('expired')
  ) {
    return 'Your sign-in session expired before completion. Please try signing in again.'
  }
  if (
    rawReason.includes('callback') ||
    rawReason.includes('state') ||
    rawReason.includes('nonce') ||
    rawError.includes('callback') ||
    rawError.includes('state') ||
    rawError.includes('nonce')
  ) {
    return 'The sign-in callback was invalid or incomplete. Please restart the sign-in flow.'
  }
  if (rawMessage) return rawMessage

  return "We couldn't complete your sign-in. This can happen if the link expired or the browser blocked a cookie. Please try again."
}

/**
 * Landing page for `${FRONTEND_URL}/auth/error`.
 *
 * The OAuth backend redirects here when state/nonce validation or the
 * provider callback fails. Replaces the previous "toast-over-landing"
 * UX with a dedicated screen so users understand what happened.
 */
export function AuthErrorPage({
  onRetry,
  error,
  reason,
  message,
  requestId,
}: AuthErrorPageProps) {
  const resolvedMessage = resolveAuthErrorMessage({ error, reason, message })

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-6 text-center max-w-sm"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <WarningCircle size={40} weight="fill" className="text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-semibold">Sign-in failed</h1>
          <p className="text-sm text-muted-foreground">{resolvedMessage}</p>
          {requestId && (
            <p className="text-xs text-muted-foreground/70 pt-1">
              Support reference: {requestId}
            </p>
          )}
        </div>
        <Button onClick={onRetry} size="lg" className="w-full">
          Try again
        </Button>
      </motion.div>
    </div>
  )
}
