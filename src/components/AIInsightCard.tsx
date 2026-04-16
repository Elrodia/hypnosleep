import { useState, useEffect, useMemo } from 'react'
import { Sparkle, ShareNetwork } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useKV } from '@github/spark/hooks'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface SessionData {
  [date: string]: number
}

interface MoodRating {
  date: string
  rating: number
  sessionName: string
  category: string
}

export function AIInsightCard() {
  const [sessionData] = useKV<SessionData>('session-activity', {})
  const [moodRatings] = useKV<MoodRating[]>('mood-ratings', [])
  const [lastRefresh, setLastRefresh] = useKV<string>('ai-insight-last-refresh', '')
  const [cachedInsight, setCachedInsight] = useKV<string>('ai-insight-cached', '')
  const [isGenerating, setIsGenerating] = useState(false)

  const weeklyStats = useMemo(() => {
    const today = new Date()
    const lastWeekStart = new Date(today)
    lastWeekStart.setDate(today.getDate() - 14)
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - 7)

    let thisWeekSessions = 0
    let lastWeekSessions = 0
    const categoryCounts: { [key: string]: number } = {}

    for (let i = 0; i < 7; i++) {
      const thisWeekDate = new Date(thisWeekStart)
      thisWeekDate.setDate(thisWeekStart.getDate() + i)
      const thisWeekDateStr = `${thisWeekDate.getFullYear()}-${String(thisWeekDate.getMonth() + 1).padStart(2, '0')}-${String(thisWeekDate.getDate()).padStart(2, '0')}`
      thisWeekSessions += sessionData?.[thisWeekDateStr] || 0

      const lastWeekDate = new Date(lastWeekStart)
      lastWeekDate.setDate(lastWeekStart.getDate() + i)
      const lastWeekDateStr = `${lastWeekDate.getFullYear()}-${String(lastWeekDate.getMonth() + 1).padStart(2, '0')}-${String(lastWeekDate.getDate()).padStart(2, '0')}`
      lastWeekSessions += sessionData?.[lastWeekDateStr] || 0
    }

    const recentMoods = (moodRatings || [])
      .filter(m => {
        const moodDate = new Date(m.date)
        return moodDate >= thisWeekStart
      })

    recentMoods.forEach(mood => {
      categoryCounts[mood.category] = (categoryCounts[mood.category] || 0) + 1
    })

    const avgMood = recentMoods.length > 0
      ? recentMoods.reduce((sum, m) => sum + m.rating, 0) / recentMoods.length
      : 0

    const topCategory = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'sleep'

    return {
      thisWeekSessions,
      lastWeekSessions,
      avgMood,
      topCategory,
      moodCount: recentMoods.length
    }
  }, [sessionData, moodRatings])

  const shouldRefresh = useMemo(() => {
    if (!lastRefresh) return true
    
    const lastRefreshDate = new Date(lastRefresh)
    const today = new Date()
    
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - today.getDay() + 1)
    lastMonday.setHours(0, 0, 0, 0)
    
    return lastRefreshDate < lastMonday
  }, [lastRefresh])

  useEffect(() => {
    const generateInsight = async () => {
      if (!shouldRefresh && cachedInsight) return
      if (isGenerating) return
      
      setIsGenerating(true)

      try {
        const { thisWeekSessions, lastWeekSessions, avgMood, topCategory, moodCount } = weeklyStats
        
        const percentChange = lastWeekSessions > 0
          ? Math.round(((thisWeekSessions - lastWeekSessions) / lastWeekSessions) * 100)
          : 0

        const promptText = `You are an insightful wellness coach analyzing user progress data. Generate a motivating 2-sentence weekly summary based on these stats:

- Sessions this week: ${thisWeekSessions}
- Sessions last week: ${lastWeekSessions}
- Percent change: ${percentChange}%
- Average mood rating this week: ${avgMood.toFixed(1)} out of 5
- Most common session category: ${topCategory}
- Number of mood ratings: ${moodCount}

The summary should:
1. First sentence: Acknowledge their progress with the session count and percentage comparison (use "more" or "less" appropriately)
2. Second sentence: Provide a specific, actionable insight based on their mood ratings and session patterns

Be conversational, encouraging, and specific. Use "you/your" language. Keep it under 50 words total.`

        const insight = await window.spark.llm(promptText, 'gpt-4o-mini')
        
        setCachedInsight(insight)
        setLastRefresh(new Date().toISOString())
      } catch (error) {
        console.error('Failed to generate insight:', error)
        setCachedInsight('You completed ' + weeklyStats.thisWeekSessions + ' sessions this week. Keep up the great work building your mindfulness practice!')
      } finally {
        setIsGenerating(false)
      }
    }

    generateInsight()
  }, [shouldRefresh, weeklyStats])

  const handleShare = async () => {
    if (!cachedInsight) return

    const shareText = `My HypnoSleep Weekly Insight:\n\n${cachedInsight}\n\n#HypnoSleep #Mindfulness`

    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText,
        })
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

  const fallbackShare = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Insight copied to clipboard!')
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
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/20 animate-[shimmer_3s_ease-in-out_infinite]" 
        style={{
          backgroundSize: '200% 200%',
        }}
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
          {isGenerating ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted/50 rounded animate-pulse w-full" />
              <div className="h-4 bg-muted/50 rounded animate-pulse w-4/5" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">
              {cachedInsight || 'Generating your weekly insight...'}
            </p>
          )}
        </div>

        <Button
          onClick={handleShare}
          disabled={isGenerating || !cachedInsight}
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
