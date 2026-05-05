import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { updateProfile } from '@/lib/api-endpoints'
import { useAuth } from '@/lib/auth-context'

interface ProfileEditDialogProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Compact dialog launched from the profile page pencil button.
 *
 * Currently supports the two fields the backend `/api/profile`
 * `PATCH` endpoint accepts (name + avatar URL). On success we
 * refresh the auth context so every consumer (header initial,
 * profile heading, etc.) updates without a page reload.
 *
 * Avatar uploads (multipart) are deliberately out of scope here —
 * the existing endpoint takes a URL string, so this dialog matches
 * that contract. A full upload flow would require a separate
 * `/api/profile/avatar` route and S3 plumbing.
 */
export function ProfileEditDialog({ isOpen, onClose }: ProfileEditDialogProps) {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [busy, setBusy] = useState(false)

  // Re-seed local state every time the dialog opens so a cancel +
  // re-open shows the current saved values, not stale edits.
  useEffect(() => {
    if (isOpen) {
      setName(user?.name ?? '')
      setAvatarUrl(user?.avatarUrl ?? '')
    }
  }, [isOpen, user])

  const trimmedName = name.trim()
  const trimmedAvatar = avatarUrl.trim()
  const dirty = trimmedName !== (user?.name ?? '') || trimmedAvatar !== (user?.avatarUrl ?? '')

  const handleSave = async () => {
    if (!trimmedName) {
      toast.error(t('profileEdit.toastNameRequired'))
      return
    }
    setBusy(true)
    try {
      await updateProfile({
        name: trimmedName,
        avatarUrl: trimmedAvatar || undefined,
      })
      // Pull the updated user back into the auth context so every
      // place that derives initials / display name from `useAuth()`
      // re-renders.
      if (typeof refresh === 'function') await refresh()
      toast.success(t('profileEdit.toastSaved'))
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profileEdit.toastError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profileEdit.title')}</DialogTitle>
          <DialogDescription>{t('profileEdit.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label htmlFor="profile-name" className="text-xs text-muted-foreground">{t('profileEdit.nameLabel')}</label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder={t('profileEdit.namePlaceholder')}
              maxLength={60}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="profile-avatar" className="text-xs text-muted-foreground">{t('profileEdit.avatarLabel')}</label>
            <Input
              id="profile-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value.slice(0, 500))}
              placeholder={t('profileEdit.avatarPlaceholder')}
              type="url"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground">
              {t('profileEdit.avatarHelper')}
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            {t('profileEdit.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={busy || !dirty} className="w-full sm:w-auto">
            {busy ? t('profileEdit.saving') : t('profileEdit.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
