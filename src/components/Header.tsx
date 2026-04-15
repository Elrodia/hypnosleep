import { useState } from 'react'
import { Bell } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useKV } from '@github/spark/hooks'

export function Header() {
  const [hasNotification, setHasNotification] = useKV('header-notification', 'true')

  const handleBellClick = () => {
    setHasNotification('false')
  }

  const showBadge = hasNotification === 'true'

  return (
    <header className="fixed top-0 left-0 right-0 h-14 border-b border-border/50 bg-card/30 backdrop-blur-xl z-50">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl" role="img" aria-label="crescent moon">
            🌙
          </span>
          <h1 className="text-xl font-serif tracking-wide text-foreground">
            HypnoSleep
          </h1>
        </div>

        <button
          onClick={handleBellClick}
          className="relative p-2 -mr-2 transition-colors hover:text-primary"
          aria-label="Notifications"
        >
          <Bell size={24} weight="regular" className="text-foreground" />
          {showBadge && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-card"
            />
          )}
        </button>
      </div>
    </header>
  )
}
