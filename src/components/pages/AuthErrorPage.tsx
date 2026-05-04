import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { WarningCircle, Copy, Check } from '@phosphor-icons/react'
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

const KNOWN_ERROR_CODES = [
  'oauth_failed',
  'oauth_cancelled',
  'invalid_state',
  'network',
  'unknown',
] as const

type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number]

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? ''

/**
 * Maps the heterogeneous `error`/`reason` strings produced by the
 * OAuth backend onto the small, fixed set of i18n keys exposed under
 * `authError.errors.*`. The mapping is intentionally narrow — when
 * nothing matches we fall through to `unknown`, which renders a
 * generic "please try again or contact support" message.
 */
function resolveErrorCode({
  error,
  reason,
}: Pick<AuthErrorPageProps, 'error' | 'reason'>): KnownErrorCode {
  const rawReason = normalize(reason)
  const rawError = normalize(error)

  // Allow the backend to send a known code directly via either field.
  if ((KNOWN_ERROR_CODES as readonly string[]).includes(rawReason)) {
    return rawReason as KnownErrorCode
  }
  if ((KNOWN_ERROR_CODES as readonly string[]).includes(rawError)) {
    return rawError as KnownErrorCode
  }

  if (
    rawReason.includes('cancel') ||
    rawError.includes('cancel') ||
    rawReason.includes('access_denied') ||
    rawError.includes('access_denied')
  ) {
    return 'oauth_cancelled'
  }
  if (
    rawReason.includes('state') ||
    rawReason.includes('nonce') ||
    rawReason.includes('expired') ||
    rawReason.includes('session') ||
    rawError.includes('state') ||
    rawError.includes('nonce') ||
    rawError.includes('expired') ||
    rawError.includes('session')
  ) {
    return 'invalid_state'
  }
  if (
    rawReason.includes('network') ||
    rawError.includes('network') ||
    rawReason.includes('rate') ||
    rawError.includes('rate')
  ) {
    return 'network'
  }
  if (
    rawReason.includes('provider') ||
    rawReason.includes('callback') ||
    rawReason.includes('oauth') ||
    rawError.includes('provider') ||
    rawError.includes('callback') ||
    rawError.includes('oauth')
  ) {
    return 'oauth_failed'
  }
  return 'unknown'
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
  message: _message,
  requestId,
}: AuthErrorPageProps) {
  const { t } = useTranslation()
  const errorCode = resolveErrorCode({ error, reason })
  const resolvedMessage = t(`authError.errors.${errorCode}`)
  const [copied, setCopied] = useState(false)

  const handleCopyRequestId = async () => {
    if (!requestId) return
    try {
      await navigator.clipboard?.writeText(requestId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable (older browsers, blocked perms) — silent */
    }
  }

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
          <h1 className="text-2xl font-serif font-semibold">{t('authError.title')}</h1>
          <p className="text-sm text-muted-foreground">{resolvedMessage}</p>
          {requestId && (
            <div className="pt-1 flex flex-col items-center gap-1.5">
              <p className="text-xs text-muted-foreground/70">
                If this keeps happening, share this reference with support:
              </p>
              <p className="text-xs text-muted-foreground/70">
                <span className="font-mono">{requestId}</span>
              </p>
              <button
                type="button"
                onClick={handleCopyRequestId}
                aria-label="Copy support reference"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-2 py-1 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? (
                  <>
                    <Check size={12} weight="bold" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} weight="regular" />
                    Copy reference
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        <Button onClick={onRetry} size="lg" className="w-full">
          {t('authError.tryAgain')}
        </Button>
      </motion.div>
    </div>
  )
}
