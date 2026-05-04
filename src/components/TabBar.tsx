import { Moon, BookOpen, PlusCircle, Star, User } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

export type TabId = 'home' | 'library' | 'create' | 'tonight' | 'profile'

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
  { id: 'home', label: 'home', icon: Moon },
  { id: 'library', label: 'library', icon: BookOpen },
  { id: 'create', label: 'create', icon: PlusCircle, isCenter: true },
  { id: 'tonight', label: 'tonight', icon: Star },
  { id: 'profile', label: 'profile', icon: User },
]

const STYLES = `
.ls-tabbar {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
`

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav
      className="ls-tabbar fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--ls-border)] bg-[var(--ls-bg)]"
      aria-label="primary navigation"
    >
      <style>{STYLES}</style>

      <div className="flex items-end justify-around px-2 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isCenter = tab.isCenter

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`group flex min-w-[64px] flex-col items-center gap-1 px-3 py-3 transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)] ${
                isCenter ? '-mt-4' : ''
              }`}
            >
              <motion.div
                className={`relative flex items-center justify-center rounded-full border transition-colors duration-200 ${
                  isCenter
                    ? 'h-12 w-12 border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)]'
                    : 'h-9 w-9 border-transparent bg-transparent'
                } ${
                  isActive
                    ? 'border-[var(--ls-sand-dim)] bg-[var(--ls-sand)]/8'
                    : 'group-hover:border-[var(--ls-border-strong)]'
                }`}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="tabbar-active-dot"
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-[var(--ls-sand)]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                  />
                )}

                <Icon
                  size={isCenter ? 28 : 22}
                  weight={isActive ? 'fill' : 'regular'}
                  className={`transition-colors duration-200 ${
                    isActive
                      ? 'text-[var(--ls-sand)]'
                      : 'text-[var(--ls-text-muted)] group-hover:text-[var(--ls-text)]'
                  }`}
                />
              </motion.div>

              <span
                className={`text-[11px] font-medium lowercase tracking-wide transition-colors duration-200 ${
                  isActive
                    ? 'text-[var(--ls-sand)]'
                    : 'text-[var(--ls-text-muted)] group-hover:text-[var(--ls-text)]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
