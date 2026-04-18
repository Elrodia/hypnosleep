import { useState } from 'react'
import { CaretLeft, CrownSimple, DownloadSimple, Trash, SignOut } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import {
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  exportProfile,
  deleteProfile,
} from '@/lib/api-endpoints'

interface AccountPageProps {
  onBack: () => void
}

export function AccountPage({ onBack }: AccountPageProps) {
  const { user, refresh, logout } = useAuth()
  const isPro = user?.plan === 'pro'

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [busy, setBusy] = useState<null | 'subscription' | 'cancel' | 'export' | 'delete'>(null)

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

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out')
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-accent flex items-center justify-center transition-colors active:scale-95"
            aria-label="Go back"
          >
            <CaretLeft className="w-6 h-6" weight="bold" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Account</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {user && (
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="font-medium">{user.name ?? 'Your account'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <CrownSimple className="w-5 h-5 text-primary" weight="fill" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium">Manage Subscription</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={isPro ? 'default' : 'secondary'}
                    className={isPro ? 'bg-primary text-primary-foreground' : ''}
                  >
                    {isPro ? 'Pro' : 'Free'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant={isPro ? 'outline' : 'default'}
              onClick={handleManageSubscription}
              disabled={busy === 'subscription'}
              className="text-xs"
            >
              {busy === 'subscription' ? '…' : isPro ? 'Manage' : 'Upgrade'}
            </Button>
          </div>

          {isPro && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <CrownSimple className="w-5 h-5 text-muted-foreground" weight="bold" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Cancel Subscription</p>
                  <p className="text-xs text-muted-foreground">Stop recurring billing at the end of the period</p>
                </div>
              </div>
            </button>
          )}

          <button
            onClick={handleExportData}
            disabled={busy === 'export'}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99] disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DownloadSimple className="w-5 h-5 text-primary" weight="bold" />
              </div>
              <div className="text-left">
                <p className="font-medium">Export My Data</p>
                <p className="text-xs text-muted-foreground">Download all your account data as JSON</p>
              </div>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <SignOut className="w-5 h-5" weight="bold" />
              </div>
              <div className="text-left">
                <p className="font-medium">Sign out</p>
                <p className="text-xs text-muted-foreground">End your session on this device</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-destructive/10 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Trash className="w-5 h-5 text-destructive" weight="bold" />
              </div>
              <div className="text-left">
                <p className="font-medium text-destructive">Delete Account</p>
                <p className="text-xs text-muted-foreground">Permanently delete your account and data</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium">Warning: This will permanently delete:</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>All your sessions and favorites</li>
                <li>Your progress and statistics</li>
                <li>All personal preferences</li>
                <li>Your account and profile</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteModal(false)
                setShowDeleteConfirm(true)
              }}
              className="w-full sm:w-auto"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Are you absolutely sure?</DialogTitle>
            <DialogDescription>
              This is your final confirmation. Your account will be deleted immediately and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-center font-semibold text-destructive">
                This action is permanent and irreversible
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="w-full sm:w-auto">
              No, Keep My Account
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinalDelete}
              disabled={busy === 'delete'}
              className="w-full sm:w-auto"
            >
              {busy === 'delete' ? 'Deleting…' : 'Yes, Delete Forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              You'll keep Pro access until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)} className="w-full sm:w-auto">
              Keep Pro
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={busy === 'cancel'}
              className="w-full sm:w-auto"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
