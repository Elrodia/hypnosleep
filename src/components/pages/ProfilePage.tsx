import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PencilSimple, Moon, Headphones, Flame, CaretRight, SlidersHorizontal, UserCircle, CreditCard, Question, Info } from '@phosphor-icons/react'
import { PreferencesPage } from './PreferencesPage'
import { AccountPage } from './AccountPage'
import { ProUpgradePage } from './ProUpgradePage'
import { HelpPage } from './HelpPage'
import { AboutPage } from './AboutPage'
import { ReferralCard } from '../ReferralCard'
import { ProfileEditDialog } from '../ProfileEditDialog'
import { useAuth } from '@/lib/auth-context'
import { getProgressStats, getStreak } from '@/lib/api-endpoints'
import { consumeUpgradeRequest } from '@/lib/upgrade-intent'

export function ProfilePage() {
  const { user } = useAuth()
  const [showPreferences, setShowPreferences] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const { data: stats } = useQuery({ queryKey: ['progress', 'stats'], queryFn: getProgressStats })
  const { data: streak } = useQuery({ queryKey: ['progress', 'streak'], queryFn: getStreak })

  const safeProfile = {
    name: user?.name ?? 'Welcome',
    email: user?.email ?? '',
    memberSince: user?.createdAt ?? new Date().toISOString(),
    avatarInitials: (user?.name ?? user?.email ?? 'U')
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('') || 'U',
  }

  const safeTotalSessions = stats?.totalSessions ?? 0
  const safeTotalListened = stats?.totalMinutes ?? 0
  const safeCurrentStreak = streak?.currentStreak ?? 0

  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString)
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    return `${month} ${year}`
  }

  const formatListenedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  useEffect(() => {
    if (consumeUpgradeRequest()) {
      setShowSubscription(true)
    }
  }, [])

  const settingsCategories = [
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'account', label: 'Account', icon: UserCircle },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'help', label: 'Help & Support', icon: Question },
    { id: 'about', label: 'About', icon: Info },
  ]

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === 'preferences') {
      setShowPreferences(true)
    } else if (categoryId === 'account') {
      setShowAccount(true)
    } else if (categoryId === 'subscription') {
      setShowSubscription(true)
    } else if (categoryId === 'help') {
      setShowHelp(true)
    } else if (categoryId === 'about') {
      setShowAbout(true)
    }
  }

  if (showPreferences) {
    return <PreferencesPage onBack={() => setShowPreferences(false)} />
  }

  if (showAccount) {
    return <AccountPage onBack={() => setShowAccount(false)} />
  }

  if (showSubscription) {
    return <ProUpgradePage onBack={() => setShowSubscription(false)} />
  }

  if (showHelp) {
    return <HelpPage onBack={() => setShowHelp(false)} />
  }

  if (showAbout) {
    return <AboutPage onBack={() => setShowAbout(false)} />
  }

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4 pb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center">
              <span className="text-3xl font-semibold text-primary-foreground">
                {safeProfile.avatarInitials}
              </span>
            </div>
            <button 
              onClick={() => setShowEdit(true)}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-card border-2 border-background flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Edit profile"
            >
              <PencilSimple className="w-4 h-4 text-foreground" weight="bold" />
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {safeProfile.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {safeProfile.email}
            </p>
            <p className="text-xs text-muted-foreground/80 pt-1">
              Member since {formatMemberSince(safeProfile.memberSince)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-primary" weight="bold" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight">
                {safeTotalSessions}
              </p>
              <p className="text-xs text-muted-foreground">
                Sessions
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Moon className="w-5 h-5 text-primary" weight="bold" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight">
                {formatListenedTime(safeTotalListened)}
              </p>
              <p className="text-xs text-muted-foreground">
                Listened
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary" weight="fill" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold tracking-tight">
                {safeCurrentStreak}
              </p>
              <p className="text-xs text-muted-foreground">
                Day Streak
              </p>
            </div>
          </div>
        </div>

        <ReferralCard />

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {settingsCategories.map((category, index) => {
            const Icon = category.icon
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors active:scale-[0.99]"
                style={{
                  borderBottom: index < settingsCategories.length - 1 ? '1px solid hsl(var(--border))' : 'none'
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" weight="bold" />
                  </div>
                  <span className="font-medium">
                    {category.label}
                  </span>
                </div>
                <CaretRight className="w-5 h-5 text-muted-foreground" weight="bold" />
              </button>
            )
          })}
        </div>
      </div>
      <ProfileEditDialog isOpen={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  )
}
