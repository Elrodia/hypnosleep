import { Moon, BookOpen, PlusCircle, ChartBar, User } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

export type TabId = 'home' | 'library' | 'create' | 'progress' | 'profile'

interface TabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

interface TabConfig {
  id: TabId
  label: string
  icon: typeof Moon
  isCenter?: boolean
}

const tabs: TabConfig[] = [
  { id: 'home', label: 'Home', icon: Moon },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'create', label: 'Create', icon: PlusCircle, isCenter: true },
  { id: 'progress', label: 'Progress', icon: ChartBar },
  { id: 'profile', label: 'Profile', icon: User },
]

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/80 backdrop-blur-lg z-50">
      <div className="flex items-end justify-around px-2 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isCenter = tab.isCenter

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-3 px-3 min-w-[64px] transition-all duration-200 ${
                isCenter ? '-mt-4' : ''
              }`}
            >
              <motion.div
                className="relative"
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
              >
                <Icon
                  size={isCenter ? 32 : 24}
                  weight={isActive ? 'fill' : 'regular'}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-[var(--hypno-accent)] tab-glow' : 'text-[var(--hypno-text-muted)]'
                  }`}
                />
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-2 bg-[var(--hypno-accent)]/20 rounded-full -z-10 blur-md"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.div>
              <span
                className={`text-[11px] font-medium tracking-wide transition-colors duration-200 ${
                  isActive ? 'text-[var(--hypno-accent)]' : 'text-[var(--hypno-text-muted)]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
