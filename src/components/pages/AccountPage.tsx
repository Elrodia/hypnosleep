import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth-context'
import {
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  exportProfile,
  deleteProfile,
  getSubscriptionStatus,
} from '@/lib/api-endpoints'

interface AccountPageProps {
  onBack: () => void
}

const STYLES = `
.ls-account {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-account .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function AccountPage({ onBack }: AccountPageProps) {
  const { t } = useTranslation()
  const { user, refresh, logout } = useAuth()

  const { data: subStatus } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: getSubscriptionStatus,
    staleTime: 60_000,
  })

  const planLabel = subStatus?.plan ?? user?.plan ?? 'free'
  const isPro = planLabel === 'pro'
  // Stripe-sourced subs return a non-null `status` field. DB-flipped
  // pros (manually promoted in MySQL with no row in `subscriptions`)
  // return `status === null/undefined` from the prompt-14 fallback.
  // Distinguish the two so we don't try to open a billing portal
  // for a customer Stripe doesn't know about.
  const hasStripeSub = Boolean(subStatus?.status)

  const planDescription = (() => {
    if (!isPro) return t('account.freePlanDesc')
    if (!hasStripeSub) return t('account.proExternalDesc')
    if (subStatus?.status === 'trialing') return t('account.proTrialingDesc')
    if (subStatus?.status === 'active') return t('account.proActiveDesc')
    if (subStatus?.cancelAtPeriodEnd) return t('account.proCancelledDesc')
    return t('account.proPlanDesc')
  })()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [busy, setBusy] = useState<
    null | 'subscription' | 'cancel' | 'export' | 'delete'
  >(null)

  const handleExportData = async () => {
    setBusy('export')
    try {
      const blob = await exportProfile()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `hypnosleep-data-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export your data.')
    } finally {
      setBusy(null)
    }
  }

  const handleFinalDelete = async () => {
    setBusy('delete')
    try {
      await deleteProfile()
      toast.success("Account deleted. We're sorry to see you go.")
      setShowDeleteConfirm(false)
      // `deleteProfile` invalidates the session on the backend; ensure
      // local state is cleared and the user is returned to the landing.
      await logout()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete account.')
    } finally {
      setBusy(null)
    }
  }

  const handleManageSubscription = async () => {
    setBusy('subscription')
    try {
      if (!isPro) {
        const { url } = await createCheckoutSession({ plan: 'monthly' })
        window.location.assign(url)
        return
      }
      const { url } = await createPortalSession()
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open billing portal.')
    } finally {
      setBusy(null)
    }
  }

  const handleCancelSubscription = async () => {
    setBusy('cancel')
    try {
      await cancelSubscription()
      await refresh()
      toast.success('Your subscription will end at the current period.')
      setShowCancelConfirm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel subscription.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="ls-account min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-10 bg-[var(--ls-bg)] border-b border-[var(--ls-border)]">
        <div className="flex items-center gap-3 h-14 px-6">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
            aria-label={t('sessionDetail.ariaBack')}
          >
            <CaretLeft className="w-5 h-5" weight="regular" />
          </button>
          <h1 className="font-fraunces italic lowercase text-xl text-[var(--ls-text)]">
            {t('account.title')}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8 pb-24 space-y-8">
        <div className="space-y-10">
          {/* Identity block */}
          <section>
            <p className="text-sm text-[var(--ls-text)] lowercase">
              {user?.name?.toLowerCase() ?? 'your account'}
            </p>
            <p className="text-xs text-[var(--ls-text-muted)] mt-1">
              {user?.email}
            </p>
          </section>

          {/* Subscription block */}
          <section className="space-y-1">
            <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
              {t('account.subscriptionHeader')}
            </h2>

            <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)] gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-base text-[var(--ls-text)] lowercase">{t('account.manageLabel')}</p>
                <p className="text-xs text-[var(--ls-text-subtle)]">
                  {planDescription}
                </p>
              </div>
              {!isPro && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={busy === 'subscription'}
                  className="px-4 h-9 rounded-md bg-[var(--ls-sand)] text-[var(--ls-bg)] hover:bg-[var(--ls-sand)]/90 transition-colors text-sm lowercase disabled:opacity-50"
                >
                  {busy === 'subscription' ? '…' : t('account.upgrade')}
                </button>
              )}
              {isPro && hasStripeSub && (
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={busy === 'subscription'}
                  className="px-4 h-9 rounded-md border border-[var(--ls-border-strong)] hover:border-[var(--ls-sand-dim)] text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors lowercase disabled:opacity-50"
                >
                  {busy === 'subscription' ? '…' : t('account.manageStripe')}
                </button>
              )}
              {isPro && !hasStripeSub && (
                <span className="text-xs text-[var(--ls-text-subtle)] lowercase whitespace-nowrap">
                  {t('account.manageExternal')}
                </span>
              )}
            </div>

            {isPro && hasStripeSub && (
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="w-full flex items-center justify-between py-4 border-b border-[var(--ls-border)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-left"
              >
                <div className="space-y-1">
                  <p className="text-base text-[var(--ls-text)] lowercase">{t('account.cancel')}</p>
                  <p className="text-xs text-[var(--ls-text-subtle)]">
                    {t('account.cancelDesc')}
                  </p>
                </div>
                <CaretRight
                  className="w-4 h-4 text-[var(--ls-text-muted)]"
                  weight="regular"
                />
              </button>
            )}

            {showCancelConfirm && (
              <div className="space-y-3 py-3">
                <p className="text-sm text-[var(--ls-text)] lowercase">
                  {t('account.cancelConfirmTitle')}
                </p>
                <p className="text-xs text-[var(--ls-text-muted)]">
                  {t('account.cancelConfirmBody')}
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    className="flex-1 h-10 rounded-md border border-[var(--ls-border-strong)] text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] transition-colors lowercase"
                  >
                    {t('account.cancelKeep')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={busy === 'cancel'}
                    className="flex-1 h-10 rounded-md border border-[var(--ls-border-strong)] text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-text-muted)] transition-colors lowercase disabled:opacity-50"
                  >
                    {busy === 'cancel' ? t('account.cancelling') : t('account.cancelDoIt')}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Data block */}
          <section className="space-y-1">
            <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
              {t('account.dataHeader')}
            </h2>

            <button
              type="button"
              onClick={handleExportData}
              disabled={busy === 'export'}
              className="w-full flex items-center justify-between py-4 border-b border-[var(--ls-border)] hover:bg-[var(--ls-bg-elevated)]/40 transition-colors text-left disabled:opacity-60"
            >
              <div className="space-y-1">
                <p className="text-base text-[var(--ls-text)] lowercase">
                  {busy === 'export' ? t('account.exportPreparing') : t('account.exportLabel')}
                </p>
                <p className="text-xs text-[var(--ls-text-subtle)]">
                  {t('account.exportDesc')}
                </p>
              </div>
              <CaretRight
                className="w-4 h-4 text-[var(--ls-text-muted)]"
                weight="regular"
              />
            </button>
          </section>

          {/* Danger zone */}
          <section className="space-y-1 pt-4">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-left py-3 text-sm text-[var(--ls-text-subtle)] hover:text-[var(--ls-text-muted)] underline-offset-4 hover:underline transition-colors lowercase"
              >
                {t('account.deleteLabel')}
              </button>
            ) : (
              <div className="space-y-3 py-3">
                <p className="text-sm text-[var(--ls-text)] lowercase">
                  {t('account.deleteConfirmTitle')}
                </p>
                <p className="text-xs text-[var(--ls-text-muted)]">
                  {t('account.deleteConfirmBody')}
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 h-10 rounded-md border border-[var(--ls-border-strong)] text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] transition-colors lowercase"
                  >
                    {t('account.deleteKeep')}
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalDelete}
                    disabled={busy === 'delete'}
                    className="flex-1 h-10 rounded-md border border-[var(--ls-border-strong)] text-sm text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-text-muted)] transition-colors lowercase disabled:opacity-50"
                  >
                    {busy === 'delete' ? t('account.deleting') : t('account.deleteDoIt')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
