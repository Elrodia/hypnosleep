import { useState } from 'react'
import { CaretLeft, LockKey, CrownSimple, DownloadSimple, Trash } from '@phosphor-icons/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useKV } from '@github/spark/hooks'
import { toast } from 'sonner'

interface AccountPageProps {
  onBack: () => void
}

export function AccountPage({ onBack }: AccountPageProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [subscriptionPlan] = useKV<'free' | 'pro'>('subscription-plan', 'free')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    toast.success('Password changed successfully')
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleExportData = async () => {
    toast.info('Preparing your data export...')
    
    setTimeout(() => {
      const userData = {
        profile: {
          name: 'Alex Morgan',
          email: 'alex.morgan@email.com',
          memberSince: '2024-01-15'
        },
        stats: {
          totalSessions: 42,
          totalMinutes: 1080,
          currentStreak: 12
        },
        preferences: {
          defaultDuration: 15,
          defaultVoice: 'Calm Female',
          backgroundSound: 'Rain'
        },
        exportDate: new Date().toISOString()
      }

      const dataStr = JSON.stringify(userData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `hypnosleep-data-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('Data exported successfully')
    }, 1500)
  }

  const handleDeleteAccount = () => {
    setShowDeleteModal(true)
  }

  const handleDeleteConfirmation = () => {
    if (!deletePassword) {
      toast.error('Please enter your password')
      return
    }

    setShowDeleteModal(false)
    setShowDeleteConfirm(true)
  }

  const handleFinalDelete = () => {
    toast.success('Account deleted. We\'re sorry to see you go.')
    setShowDeleteConfirm(false)
    setDeletePassword('')
  }

  const handleManageSubscription = () => {
    if (subscriptionPlan === 'free') {
      toast.info('Upgrade to Pro coming soon!')
    } else {
      toast.info('Opening subscription management...')
    }
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

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LockKey className="w-5 h-5 text-primary" weight="bold" />
              </div>
              <div className="text-left">
                <p className="font-medium">Change Password</p>
                <p className="text-xs text-muted-foreground">Update your account password</p>
              </div>
            </div>
          </button>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <CrownSimple className="w-5 h-5 text-primary" weight="fill" />
              </div>
              <div className="text-left">
                <p className="font-medium">Manage Subscription</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={subscriptionPlan === 'pro' ? 'default' : 'secondary'}
                    className={subscriptionPlan === 'pro' ? 'bg-primary text-primary-foreground' : ''}
                  >
                    {subscriptionPlan === 'free' ? 'Free' : 'Pro'}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant={subscriptionPlan === 'free' ? 'default' : 'outline'}
              onClick={handleManageSubscription}
              className="text-xs"
            >
              {subscriptionPlan === 'free' ? 'Upgrade' : 'Manage'}
            </Button>
          </div>

          <button
            onClick={handleExportData}
            className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DownloadSimple className="w-5 h-5 text-primary" weight="bold" />
              </div>
              <div className="text-left">
                <p className="font-medium">Export My Data</p>
                <p className="text-xs text-muted-foreground">Download all your account data</p>
              </div>
            </div>
          </button>

          <button
            onClick={handleDeleteAccount}
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

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordModal(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              className="w-full sm:w-auto"
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p className="text-sm text-destructive font-medium">
                Warning: This will permanently delete:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>All your sessions and favorites</li>
                <li>Your progress and statistics</li>
                <li>All personal preferences</li>
                <li>Your account and profile</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false)
                setDeletePassword('')
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirmation}
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
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false)
                setDeletePassword('')
              }}
              className="w-full sm:w-auto"
            >
              No, Keep My Account
            </Button>
            <Button
              variant="destructive"
              onClick={handleFinalDelete}
              className="w-full sm:w-auto"
            >
              Yes, Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
