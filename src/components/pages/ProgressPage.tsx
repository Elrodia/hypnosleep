import { useState, useMemo } from 'react'
import { CaretLeft, CaretRight, Clock, Headphones, Fire, Trophy } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useKV } from '@github/spark/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { AnimatedCounter } from '@/components/AnimatedCounter'

interface SessionData {
  [date: string]: number
}

interface TooltipData {
  date: string
  sessions: number
  minutes: number
  x: number
  y: number
}

export function ProgressPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sessionData] = useKV<SessionData>('session-activity', {})
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const { year, month, monthName, daysInMonth, firstDayOfWeek, today } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long' })
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()
    const today = new Date()
    
    return { year, month, monthName, daysInMonth, firstDayOfWeek, today }
  }, [currentDate])

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setTooltip(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setTooltip(null)
  }

  const getSessionsForDay = (day: number): number => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return sessionData?.[dateStr] || 0
  }

  const getMinutesForDay = (sessions: number): number => {
    return sessions * 15
  }

  const getIntensityColor = (sessions: number): string => {
    if (sessions === 0) return 'bg-card border border-border/50'
    if (sessions === 1) return 'bg-primary/20 border border-primary/30'
    if (sessions === 2) return 'bg-primary/50 border border-primary/60'
    return 'bg-primary border border-primary'
  }

  const isToday = (day: number): boolean => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  const handleDayClick = (day: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const sessions = getSessionsForDay(day)
    const minutes = getMinutesForDay(sessions)
    const rect = event.currentTarget.getBoundingClientRect()
    
    setTooltip({
      date: `${monthName} ${day}, ${year}`,
      sessions,
      minutes,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    })
  }

  const handleDayLeave = () => {
    setTooltip(null)
  }

  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - firstDayOfWeek + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null
    }
    return dayNumber
  })

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const totalSessions = useMemo(() => {
    let total = 0
    for (let day = 1; day <= daysInMonth; day++) {
      total += getSessionsForDay(day)
    }
    return total
  }, [sessionData, year, month, daysInMonth])

  const totalMinutes = useMemo(() => {
    return totalSessions * 15
  }, [totalSessions])

  const thisWeekStats = useMemo(() => {
    const todayDate = new Date()
    const todayDayOfWeek = todayDate.getDay()
    const startOfWeek = new Date(todayDate)
    startOfWeek.setDate(todayDate.getDate() - todayDayOfWeek)
    
    let weekSessions = 0
    let weekMinutes = 0
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startOfWeek)
      checkDate.setDate(startOfWeek.getDate() + i)
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
      const sessions = sessionData?.[dateStr] || 0
      weekSessions += sessions
      weekMinutes += sessions * 15
    }
    
    return {
      sessions: weekSessions,
      minutes: weekMinutes,
    }
  }, [sessionData])

  const [currentStreak] = useKV<number>('current-streak', 5)
  const [bestStreak] = useKV<number>('best-streak', 12)

  return (
    <div className="p-4 pb-8">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Progress</h1>

      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            className="h-9 w-9 hover:bg-primary/10"
          >
            <CaretLeft className="text-foreground" />
          </Button>

          <h2 className="text-lg font-semibold">
            {monthName} {year}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-9 w-9 hover:bg-primary/10"
          >
            <CaretRight className="text-foreground" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, i) => (
            <div
              key={i}
              className="text-xs text-muted-foreground font-medium text-center pb-2"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {calendarDays.map((day, i) => (
            <div key={i} className="aspect-square">
              {day ? (
                <button
                  onClick={(e) => handleDayClick(day, e)}
                  onMouseEnter={(e) => handleDayClick(day, e)}
                  onMouseLeave={handleDayLeave}
                  className={`
                    w-full h-full rounded-lg transition-all duration-200
                    ${getIntensityColor(getSessionsForDay(day))}
                    ${isToday(day) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                    hover:scale-110 active:scale-95
                    flex items-center justify-center
                    text-xs font-medium
                  `}
                >
                  <span className={getSessionsForDay(day) > 0 ? 'text-primary-foreground' : 'text-muted-foreground'}>
                    {day}
                  </span>
                </button>
              ) : (
                <div className="w-full h-full" />
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded bg-card border border-border/50" />
              <div className="w-4 h-4 rounded bg-primary/20 border border-primary/30" />
              <div className="w-4 h-4 rounded bg-primary/50 border border-primary/60" />
              <div className="w-4 h-4 rounded bg-primary border border-primary" />
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">This Week</h2>
        <div className="grid grid-cols-2 gap-3">
          <motion.div 
            className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <Clock className="text-primary mb-2" size={24} weight="duotone" />
              <div className="text-2xl font-bold text-foreground mb-1">
                <AnimatedCounter value={thisWeekStats.minutes} />
              </div>
              <div className="text-sm text-muted-foreground">Total Minutes</div>
            </div>
          </motion.div>

          <motion.div 
            className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <Headphones className="text-primary mb-2" size={24} weight="duotone" />
              <div className="text-2xl font-bold text-foreground mb-1">
                <AnimatedCounter value={thisWeekStats.sessions} />
              </div>
              <div className="text-sm text-muted-foreground">Sessions</div>
            </div>
          </motion.div>

          <motion.div 
            className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <Fire className="text-primary mb-2" size={24} weight="duotone" />
              <div className="text-2xl font-bold text-foreground mb-1">
                <AnimatedCounter value={currentStreak ?? 0} suffix=" days" />
              </div>
              <div className="text-sm text-muted-foreground">Current Streak</div>
            </div>
          </motion.div>

          <motion.div 
            className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <Trophy className="text-primary mb-2" size={24} weight="duotone" />
              <div className="text-2xl font-bold text-foreground mb-1">
                <AnimatedCounter value={bestStreak ?? 0} />
              </div>
              <div className="text-sm text-muted-foreground">Best Streak</div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-primary mb-1">{totalSessions}</div>
          <div className="text-sm text-muted-foreground">Sessions this month</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-2xl font-bold text-primary mb-1">{totalMinutes}</div>
          <div className="text-sm text-muted-foreground">Total minutes</div>
        </div>
      </div>

      <AnimatePresence>
        {tooltip && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setTooltip(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 pointer-events-none"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)',
                minWidth: '160px',
              }}
            >
              <div className="text-xs font-medium text-foreground mb-1">
                {tooltip.date}
              </div>
              <div className="text-sm font-semibold text-primary">
                {tooltip.sessions} {tooltip.sessions === 1 ? 'session' : 'sessions'}
              </div>
              <div className="text-xs text-muted-foreground">
                {tooltip.minutes} minutes
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
