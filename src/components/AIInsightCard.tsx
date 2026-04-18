import { useQuery } from '@tanstack/react-query'
import { Sparkle, ShareNetwork } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { getWeeklyInsight } from '@/lib/api-endpoints'

/**
 * Weekly AI-generated insight card. The backend
 * (`GET /api/progress/weekly-insight`) owns the prompt, the Gemini
 * call and week-long caching, so the frontend is purely a view.
 */
export function AIInsightCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['progress', 'weekly-insight'],
    queryFn: getWeeklyInsight,
    // Week-long cache on the backend; no reason to refetch on focus.
    staleTime: 60 * 60 * 1000,
  })

  const insight = data?.insight ?? ''

  const fallbackShare = (text: string) => {
    void navigator.clipboard?.writeText(text)
    toast.success('Insight copied to clipboard!')
  }

  const handleShare = async () => {
    if (!insight) return
    const shareText = `My HypnoSleep Weekly Insight:\n\n${insight}\n\n#HypnoSleep #Mindfulness`

    if (navigator.share) {
      try {
        await navigator.share({ text: shareText })
        toast.success('Insight shared!')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          fallbackShare(shareText)
        }
      }
    } else {
      fallbackShare(shareText)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative bg-gradient-to-br from-card to-card/50 rounded-2xl p-[2px] mb-4 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, oklch(0.58 0.18 285), oklch(0.48 0.20 270), oklch(0.58 0.18 285))',
        backgroundSize: '200% 200%',
      }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/20 animate-[shimmer_3s_ease-in-out_infinite]"
        style={{ backgroundSize: '200% 200%' }}
      />

      <div className="relative bg-card rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkle className="text-primary" size={20} weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-primary mb-1">AI Insight</h3>
            <div className="text-xs text-muted-foreground">Weekly summary • Refreshes Monday</div>
          </div>
        </div>

        <div className="mb-4">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
              <div className="h-4 bg-muted/50 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">
              {insight || 'Keep listening to unlock your first weekly insight.'}
            </p>
          )}
        </div>

        <Button
          onClick={handleShare}
          disabled={isLoading || !insight}
          variant="outline"
          size="sm"
          className="w-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary hover:text-primary"
        >
          <ShareNetwork size={16} weight="bold" className="mr-2" />
          Share Insight
        </Button>
      </div>
    </motion.div>
  )
}
