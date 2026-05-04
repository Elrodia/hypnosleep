import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PencilSimple, CaretRight, SignOut } from '@phosphor-icons/react'
import { PreferencesPage } from './PreferencesPage'
import { AccountPage } from './AccountPage'
import { ProUpgradePage } from './ProUpgradePage'
import { HelpPage } from './HelpPage'
import { AboutPage } from './AboutPage'
import { ProfileEditDialog } from '../ProfileEditDialog'
import { useAuth } from '@/lib/auth-context'
import { getProgressStats, getStreak, getSubscriptionStatus } from '@/lib/api-endpoints'
import { consumeUpgradeRequest } from '@/lib/upgrade-intent'

// Liminal `--ls-*` tokens are page-local (not on :root), so this component
// must declare them itself or none of the `var(--ls-*)` colours and the
// hover/active utilities that rely on them resolve. `active:` mirrors
// `hover:` so touch (mobile) users see the same press feedback that
// desktop users get on hover.
const STYLES = `
.ls-profile {
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
  -webkit-tap-highlight-color: transparent;
}
.ls-profile .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function ProfilePage() {
  const { user, logout } = useAuth()
  const [showPreferences, setShowPreferences] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const { data: stats } = useQuery({ queryKey: ['progress', 'stats'], queryFn: getProgressStats })
  const { data: streak } = useQuery({ queryKey: ['progress', 'streak'], queryFn: getStreak })
  const { data: subStatus } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: getSubscriptionStatus,
    // Subscription state changes rarely; cache aggressively to avoid
    // hammering Stripe on every Profile mount.
    staleTime: 60_000,
  })

  const planLabel = subStatus?.plan ?? user?.plan ?? 'free'
  const isPro = planLabel === 'pro'

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
    { id: 'preferences', label: 'Preferences' },
    { id: 'account', label: 'Account' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'help', label: 'Help & Support' },
    { id: 'about', label: 'About' },
  ] as const

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
    <div className="ls-profile min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>
      <div className="mx-auto max-w-xl px-6 pt-12 pb-24 space-y-12">

        {/* === HEADER: avatar + name + meta === */}
        <header className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border border-[var(--ls-sand)] flex items-center justify-center bg-[var(--ls-bg)]">
              <span className="font-fraunces italic text-2xl text-[var(--ls-sand)]">
                {safeProfile.avatarInitials.toLowerCase()}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--ls-bg-elevated)] border border-[var(--ls-border-strong)] flex items-center justify-center hover:border-[var(--ls-sand-dim)] active:border-[var(--ls-sand)] active:scale-95 transition-all"
              aria-label="edit profile"
            >
              <PencilSimple className="w-3.5 h-3.5 text-[var(--ls-text-muted)]" weight="regular" />
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="font-fraunces italic lowercase text-3xl text-[var(--ls-text)]">
              {safeProfile.name.toLowerCase()}
            </h1>
            <p className="text-sm text-[var(--ls-text-muted)]">
              {safeProfile.email}
            </p>
            <p className="text-xs text-[var(--ls-text-subtle)] pt-1">
              member since {formatMemberSince(safeProfile.memberSince).toLowerCase()}
            </p>
          </div>
        </header>

        {/* === STATS: three numbers, no boxes === */}
        <section className="grid grid-cols-3 gap-2 py-4 border-y border-[var(--ls-border)]">
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="font-fraunces italic text-3xl text-[var(--ls-text)] tabular-nums">
              {safeTotalSessions}
            </span>
            <span className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              sessions
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 py-2 border-x border-[var(--ls-border)]">
            <span className="font-fraunces italic text-3xl text-[var(--ls-text)] tabular-nums">
              {formatListenedTime(safeTotalListened)}
            </span>
            <span className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              listened
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="font-fraunces italic text-3xl text-[var(--ls-text)] tabular-nums">
              {safeCurrentStreak}
            </span>
            <span className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              day streak
            </span>
          </div>
        </section>

        {/* === SETTINGS MENU === */}
        <nav aria-label="settings" className="space-y-px">
          {settingsCategories.map((category) => {
            const isSubscription = category.id === 'subscription'
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryClick(category.id)}
                className="w-full flex items-center justify-between py-4 border-b border-[var(--ls-border)] hover:bg-[var(--ls-bg-elevated)]/40 active:bg-[var(--ls-bg-elevated)]/70 transition-colors group"
              >
                <span className="text-base text-[var(--ls-text)] lowercase">
                  {category.label.toLowerCase()}
                </span>
                <div className="flex items-center gap-3 text-[var(--ls-text-muted)] group-hover:text-[var(--ls-text)] group-active:text-[var(--ls-text)] transition-colors">
                  {isSubscription && (
                    <span
                      className={
                        isPro
                          ? 'text-xs lowercase text-[var(--ls-sand)]'
                          : 'text-xs lowercase text-[var(--ls-sand-dim)]'
                      }
                    >
                      {planLabel}
                    </span>
                  )}
                  <CaretRight className="w-4 h-4" weight="regular" />
                </div>
              </button>
            )
          })}
        </nav>

        {/* === LOGOUT === */}
        <section className="pt-2">
          <button
            type="button"
            onClick={async () => {
              await logout()
              // The auth context listener in App.tsx will route us back to
              // the landing page when status flips to 'unauthenticated'.
            }}
            className="w-full flex items-center justify-between py-4 border-b border-[var(--ls-border)] hover:bg-[var(--ls-bg-elevated)]/40 active:bg-[var(--ls-bg-elevated)]/70 transition-colors group"
          >
            <span className="text-base text-[var(--ls-text-muted)] group-hover:text-[var(--ls-text)] group-active:text-[var(--ls-text)] lowercase transition-colors">
              sign out
            </span>
            <SignOut
              className="w-4 h-4 text-[var(--ls-text-muted)] group-hover:text-[var(--ls-text)] group-active:text-[var(--ls-text)] transition-colors"
              weight="regular"
            />
          </button>
        </section>

        {/* === FOOTER: discreet referral link === */}
        <footer className="pt-8 flex flex-col items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => {
              // Surface the existing referral mechanic without giving it
              // page-level real estate. The dedicated /referral route
              // (or the ReferralCard mounted there) is where the loud
              // viral-loop UI lives, if/when it justifies its space.
              window.dispatchEvent(new CustomEvent('navigate-to-referral'))
            }}
            className="text-[var(--ls-text-muted)] hover:text-[var(--ls-sand)] active:text-[var(--ls-sand)] underline-offset-4 hover:underline active:underline transition-colors"
          >
            share with a friend
          </button>
          <p className="text-[var(--ls-text-subtle)]">
            give 7 days free, get 7 days free
          </p>
        </footer>

      </div>

      <ProfileEditDialog isOpen={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  )
}
