import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export type ReportReason = 'inappropriate' | 'inaccurate' | 'unsafe' | 'low_quality' | 'other'

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'inaccurate', label: 'Inaccurate or misleading' },
  { id: 'unsafe', label: 'Unsafe / harmful' },
  { id: 'low_quality', label: 'Low audio / script quality' },
  { id: 'other', label: 'Other' },
]

interface ReportSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: ReportReason, details: string) => Promise<void> | void
}

/**
 * Lightweight modal for the FullScreenPlayer "Report" entry. We
 * collect a categorical reason plus optional free-text details and
 * hand them off to the parent, which POSTs to
 * `/api/sessions/:id/report`.
 */
export function ReportSessionModal({ isOpen, onClose, onSubmit }: ReportSessionModalProps) {
  const [reason, setReason] = useState<ReportReason>('inappropriate')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async () => {
    setBusy(true)
    try {
      await onSubmit(reason, details.trim())
      setDetails('')
      setReason('inappropriate')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this session</DialogTitle>
          <DialogDescription>
            Help us improve. Reports are reviewed by our team within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            {REASONS.map((r) => (
              <label
                key={r.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  reason === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="accent-[var(--primary)]"
                />
                <span className="text-sm">{r.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="report-details" className="text-xs text-muted-foreground">
              Additional details (optional)
            </label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              placeholder="What happened?"
              className="min-h-[90px] resize-none"
            />
            <div className="text-right text-[10px] text-muted-foreground">{details.length}/500</div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} className="w-full sm:w-auto">
            {busy ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
