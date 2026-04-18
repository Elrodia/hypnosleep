import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { getStreak, getHeatmap } from '@/lib/api-endpoints'

interface StreakDay {
  date: string
  completed: boolean
}

export function StreakWidget() {
  const { data: streak } = useQuery({
    queryKey: ['progress', 'streak'],
    queryFn: getStreak,
  })
  const { data: heatmap } = useQuery({
    queryKey: ['progress', 'heatmap', 7],
    queryFn: () => getHeatmap(14),
  })

  const currentStreak = streak?.currentStreak ?? 0
  const streakRecord = streak?.longestStreak ?? 0

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const getLast7Days = (): StreakDay[] => {
    const today = new Date()
    const days: StreakDay[] = []
    const heatmapMap = new Map<string, number>()
    for (const p of heatmap ?? []) heatmapMap.set(p.date, p.count)

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateString = date.toISOString().split('T')[0]
      days.push({ date: dateString, completed: (heatmapMap.get(dateString) ?? 0) > 0 })
    }

    return days
  }

  const isToday = (dateString: string): boolean => {
    const today = new Date().toISOString().split('T')[0]
    return dateString === today
  }

  const weekDays = getLast7Days()
  const daysUntilRecord = Math.max(0, streakRecord + 1 - currentStreak)

  const flameHeight = Math.min(100, 40 + currentStreak * 3)

  const getMotivationalText = () => {
    if (currentStreak === 0) {
      return 'Start your journey today! 🌟'
    } else if (daysUntilRecord === 0) {
      return "New record! You're on fire! 🔥"
    } else if (daysUntilRecord === 1) {
      return 'Just 1 more day to beat your record!'
    } else if (daysUntilRecord <= 3) {
      return `Keep going! ${daysUntilRecord} more days to your record.`
    } else {
      return `${currentStreak} day streak! Keep it up!`
    }
  }

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-5 shadow-sm">
      <div className="flex gap-6 mb-5">
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex items-baseline gap-2 mb-1">
            <motion.span 
              className="text-5xl font-bold text-foreground"
              key={currentStreak}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              {currentStreak}
            </motion.span>
            <motion.span 
              className="text-3xl"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatDelay: 2,
              }}
            >
              🔥
            </motion.span>
          </div>
          <p className="text-sm text-muted-foreground font-medium">days</p>
          
          <div className="mt-3 relative">
            <div className="w-16 h-24 relative">
              <motion.div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 rounded-t-full"
                style={{
                  background: 'linear-gradient(to top, #dc2626, #f97316, #fbbf24)',
                  filter: 'blur(2px)',
                }}
                animate={{
                  height: `${flameHeight}%`,
                }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
              />
              <motion.div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 rounded-t-full"
                style={{
                  background: 'linear-gradient(to top, #f97316, #fbbf24, #fef3c7)',
                }}
                animate={{
                  height: `${flameHeight * 0.8}%`,
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  height: { type: 'spring', stiffness: 100, damping: 20 },
                  scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {daysOfWeek.map((day, idx) => (
              <div
                key={day}
                className="text-center text-[10px] font-medium text-muted-foreground"
              >
                {day.charAt(0)}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day, idx) => {
              const today = isToday(day.date)
              return (
                <motion.div
                  key={day.date}
                  className="aspect-square flex items-center justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {day.completed ? (
                    <div className="w-full h-full rounded-full bg-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                    </div>
                  ) : today ? (
                    <div className="w-full h-full rounded-full border-2 border-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-full border border-border flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center font-medium">
          {getMotivationalText()}
        </p>
      </div>
    </div>
  )
}
