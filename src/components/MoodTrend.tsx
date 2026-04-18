import { useMemo, useState } from 'react'
import { useKV } from '@/hooks/use-kv'
import { motion, AnimatePresence } from 'framer-motion'

interface MoodRating {
  date: string
  mood: number
  sessionName: string
}

interface TooltipData {
  date: string
  mood: number
  sessionName: string
  x: number
  y: number
}

const MOOD_EMOJIS = {
  1: '😫',
  2: '😐',
  3: '🙂',
  4: '😊',
  5: '🤩',
}

const MOOD_LABELS = {
  1: 'Worse',
  2: 'Same',
  3: 'Better',
  4: 'Great',
  5: 'Amazing',
}

export function MoodTrend() {
  const [moodRatings] = useKV<MoodRating[]>('mood-ratings', [])
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const last30DaysData = useMemo(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 29)

    const ratingsInRange = (moodRatings || []).filter((rating) => {
      const ratingDate = new Date(rating.date)
      return ratingDate >= thirtyDaysAgo && ratingDate <= today
    })

    return ratingsInRange.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [moodRatings])

  const averageMood = useMemo(() => {
    if (last30DaysData.length === 0) return 0
    const sum = last30DaysData.reduce((acc, rating) => acc + rating.mood, 0)
    return sum / last30DaysData.length
  }, [last30DaysData])

  const chartConfig = useMemo(() => {
    if (last30DaysData.length === 0) return null

    const padding = { top: 40, right: 20, bottom: 40, left: 50 }
    const width = 340
    const height = 280
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const minMood = 1
    const maxMood = 5

    const points = last30DaysData.map((rating, index) => {
      const x = padding.left + (index / Math.max(last30DaysData.length - 1, 1)) * chartWidth
      const y = padding.top + chartHeight - ((rating.mood - minMood) / (maxMood - minMood)) * chartHeight
      return { x, y, rating }
    })

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    const gradientId = 'moodGradient'

    const averageY = padding.top + chartHeight - ((averageMood - minMood) / (maxMood - minMood)) * chartHeight

    return {
      width,
      height,
      padding,
      chartWidth,
      chartHeight,
      points,
      pathData,
      gradientId,
      averageY,
      minMood,
      maxMood,
    }
  }, [last30DaysData, averageMood])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handlePointClick = (
    rating: MoodRating,
    x: number,
    y: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation()
    const container = event.currentTarget.closest('svg')
    if (!container) return

    const rect = container.getBoundingClientRect()
    const absoluteX = rect.left + x
    const absoluteY = rect.top + y

    setTooltip({
      date: formatDate(rating.date),
      mood: rating.mood,
      sessionName: rating.sessionName,
      x: absoluteX,
      y: absoluteY,
    })
  }

  const handleCloseTooltip = () => {
    setTooltip(null)
  }

  if (last30DaysData.length < 3) {
    return (
      <motion.div
        className="bg-card border border-border rounded-2xl p-6 mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <h2 className="text-lg font-semibold mb-4">Mood Trend</h2>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-muted-foreground text-center text-sm">
            Not enough data
          </p>
          <p className="text-muted-foreground text-center text-xs mt-2">
            Complete at least 3 sessions with mood ratings to see your trend
          </p>
        </div>
      </motion.div>
    )
  }

  if (!chartConfig) return null

  const { width, height, padding, points, pathData, gradientId, averageY } = chartConfig

  return (
    <motion.div
      className="bg-card border border-border rounded-2xl p-6 mb-4 relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    >
      <h2 className="text-lg font-semibold mb-4">Mood Trend</h2>
      <p className="text-xs text-muted-foreground mb-4">Past 30 days</p>

      <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
        <svg
          width={width}
          height={height}
          className="touch-none select-none"
          onClick={handleCloseTooltip}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.48 0.18 285)" />
              <stop offset="50%" stopColor="oklch(0.58 0.18 285)" />
              <stop offset="100%" stopColor="oklch(0.68 0.18 285)" />
            </linearGradient>
          </defs>

          <text
            x={padding.left - 10}
            y={padding.top}
            textAnchor="end"
            className="text-xs fill-muted-foreground"
            fontSize="18"
          >
            🤩
          </text>
          <text
            x={padding.left - 10}
            y={padding.top + (height - padding.top - padding.bottom) * 0.25}
            textAnchor="end"
            className="text-xs fill-muted-foreground"
            fontSize="18"
          >
            😊
          </text>
          <text
            x={padding.left - 10}
            y={padding.top + (height - padding.top - padding.bottom) * 0.5}
            textAnchor="end"
            className="text-xs fill-muted-foreground"
            fontSize="18"
          >
            🙂
          </text>
          <text
            x={padding.left - 10}
            y={padding.top + (height - padding.top - padding.bottom) * 0.75}
            textAnchor="end"
            className="text-xs fill-muted-foreground"
            fontSize="18"
          >
            😐
          </text>
          <text
            x={padding.left - 10}
            y={height - padding.bottom}
            textAnchor="end"
            className="text-xs fill-muted-foreground"
            fontSize="18"
          >
            😫
          </text>

          <line
            x1={padding.left}
            y1={averageY}
            x2={width - padding.right}
            y2={averageY}
            stroke="oklch(0.58 0.18 285)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.5"
          />
          <text
            x={width - padding.right}
            y={averageY - 6}
            textAnchor="end"
            className="text-[10px] fill-primary font-medium"
          >
            Avg: {averageMood.toFixed(1)}
          </text>

          <path
            d={pathData}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="oklch(0.08 0.02 285)"
                stroke={`url(#${gradientId})`}
                strokeWidth="3"
                className="cursor-pointer transition-all hover:r-10"
                onClick={(e) => handlePointClick(point.rating, point.x, point.y, e)}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="12"
                fill="transparent"
                className="cursor-pointer"
                onClick={(e) => handlePointClick(point.rating, point.x, point.y, e)}
              />
            </g>
          ))}

          {points.length > 0 && (
            <>
              <text
                x={points[0].x}
                y={height - padding.bottom + 20}
                textAnchor="start"
                className="text-[10px] fill-muted-foreground"
              >
                {formatDate(points[0].rating.date)}
              </text>
              <text
                x={points[points.length - 1].x}
                y={height - padding.bottom + 20}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground"
              >
                {formatDate(points[points.length - 1].rating.date)}
              </text>
            </>
          )}
        </svg>
      </div>

      <AnimatePresence>
        {tooltip && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={handleCloseTooltip}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 bg-card border border-primary/50 rounded-lg shadow-xl p-3 pointer-events-none"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -110%)',
                minWidth: '160px',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{MOOD_EMOJIS[tooltip.mood as keyof typeof MOOD_EMOJIS]}</span>
                <div>
                  <div className="text-xs font-medium text-foreground">
                    {MOOD_LABELS[tooltip.mood as keyof typeof MOOD_LABELS]}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {tooltip.date}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                {tooltip.sessionName}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
