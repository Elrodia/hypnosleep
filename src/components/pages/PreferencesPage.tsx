import { CaretLeft } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useKV } from '@/hooks/use-kv'

// Voice ids match the backend `VOICES` registry so the value the user
// picks here is the same value the Create screen sends to
// `/api/sessions/generate` — no display-to-id mapping needed. Pro
// locking is enforced at the Create-page level; the Preferences page
// just stores the user's preferred default.
const VOICE_OPTIONS = [
  { value: 'en-US-AnaNeural', label: 'calm female' },
  { value: 'en-US-GuyNeural', label: 'deep male' },
  { value: 'en-US-AriaNeural', label: 'soft whisper' },
  { value: 'en-GB-SoniaNeural', label: 'gentle british' },
  { value: 'en-AU-NatashaNeural', label: 'warm australian' },
  { value: 'en-US-DavisNeural', label: 'steady guide' },
] as const

const BACKGROUND_SOUND_OPTIONS = [
  { value: 'silence', label: 'silence' },
  { value: 'rain', label: 'rain' },
  { value: 'ocean', label: 'ocean' },
  { value: 'forest', label: 'forest' },
  { value: 'wind', label: 'wind' },
] as const

// Aligned with the system's real session caps.
// Free users get 5 min only; Pro users get 3–12 min.
// We surface the two values that work for everyone here.
const SESSION_LENGTH_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
] as const

const STYLES = `
.ls-preferences {
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
.ls-preferences .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

interface PreferencesPageProps {
  onBack?: () => void
}

export function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [dailyReminderEnabled, setDailyReminderEnabled] = useKV<boolean>('daily-reminder-enabled', false)
  const [reminderTime, setReminderTime] = useKV<string>('reminder-time', '22:00')
  const [defaultSessionLength, setDefaultSessionLength] = useKV<string>('default-session-length', '5')
  const [defaultVoice, setDefaultVoice] = useKV<string>('default-voice', 'en-US-AnaNeural')
  const [backgroundSound, setBackgroundSound] = useKV<string>('background-sound', 'silence')
  const [theme, setTheme] = useKV<'dark' | 'light'>('theme', 'dark')

  // Coerce stored values that are no longer offered (legacy 15/20/30
  // from before this page got trimmed) back to the safe default.
  const sessionLengthValue = (() => {
    const v = defaultSessionLength ?? '5'
    return v === '10' ? '10' : '5'
  })()

  const handleThemeToggle = (checked: boolean) => {
    const newTheme = checked ? 'light' : 'dark'
    setTheme(newTheme)
    // Apply immediately so the toggle takes visual effect without
    // waiting for a route change. The bootstrap effect in main.tsx
    // mirrors this on initial page load.
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', newTheme === 'light')
    }
    // Mirror to localStorage so main.tsx's pre-mount bootstrap can
    // pick the right theme on the next reload without a network call.
    try {
      localStorage.setItem('hypno-theme', newTheme)
    } catch {
      /* private-mode browsers — non-fatal */
    }
  }

  const inputClass =
    'h-9 px-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-sm text-[var(--ls-text)] focus:outline-none focus:border-[var(--ls-sand)] transition-colors'

  const selectTriggerClass =
    'h-9 px-3 rounded-md border border-[var(--ls-border-strong)] bg-transparent text-sm text-[var(--ls-text)] focus:outline-none focus:border-[var(--ls-sand)] transition-colors data-[placeholder]:text-[var(--ls-text-muted)]'

  const selectContentClass =
    'bg-[var(--ls-bg-elevated)] border-[var(--ls-border-strong)] text-[var(--ls-text)]'

  return (
    <div className="ls-preferences min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-10 bg-[var(--ls-bg)] border-b border-[var(--ls-border)]">
        <div className="flex items-center gap-3 h-14 px-6">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
            aria-label="back"
          >
            <CaretLeft className="w-5 h-5" weight="regular" />
          </button>
          <h1 className="font-fraunces italic lowercase text-xl text-[var(--ls-text)]">
            preferences
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8 pb-24 space-y-8">
        <section>
          {/* daily reminder */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <label
              htmlFor="daily-reminder"
              className="text-base text-[var(--ls-text)] lowercase cursor-pointer"
            >
              daily reminder
            </label>
            <Switch
              id="daily-reminder"
              checked={dailyReminderEnabled ?? false}
              onCheckedChange={setDailyReminderEnabled}
              className="data-[state=checked]:bg-[var(--ls-sand)]"
            />
          </div>

          {/* reminder time — only when reminder enabled */}
          {dailyReminderEnabled && (
            <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
              <label
                htmlFor="reminder-time"
                className="text-base text-[var(--ls-text)] lowercase cursor-pointer"
              >
                reminder time
              </label>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime ?? '22:00'}
                onChange={(e) => setReminderTime(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {/* default length — two-button picker for visual consistency
              with the Create page's length picker */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <span className="text-base text-[var(--ls-text)] lowercase">
              default length
            </span>
            <div className="flex gap-2">
              {SESSION_LENGTH_OPTIONS.map((option) => {
                const isActive = sessionLengthValue === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDefaultSessionLength(option.value)}
                    className={[
                      'px-3 h-9 rounded-md border text-sm transition-colors lowercase',
                      isActive
                        ? 'border-[var(--ls-sand)] bg-[var(--ls-sand)]/8 text-[var(--ls-text)]'
                        : 'border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] hover:border-[var(--ls-sand-dim)] hover:text-[var(--ls-text)]',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* default voice */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <span className="text-base text-[var(--ls-text)] lowercase">
              default voice
            </span>
            <Select
              value={defaultVoice ?? 'en-US-AnaNeural'}
              onValueChange={setDefaultVoice}
            >
              <SelectTrigger className={`${selectTriggerClass} w-[180px]`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {VOICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* language — between default voice and background, per
              28a spec. The switcher persists choice to localStorage
              and (when authenticated) PATCHes /api/profile so the
              choice follows the user across devices. */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <span className="text-base text-[var(--ls-text)] lowercase">
              language
            </span>
            <LanguageSwitcher variant="default" />
          </div>

          {/* background */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <span className="text-base text-[var(--ls-text)] lowercase">
              background
            </span>
            <Select
              value={backgroundSound ?? 'silence'}
              onValueChange={setBackgroundSound}
            >
              <SelectTrigger className={`${selectTriggerClass} w-[140px]`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={selectContentClass}>
                {BACKGROUND_SOUND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* theme */}
          <div className="flex items-center justify-between py-4 border-b border-[var(--ls-border)]">
            <label
              htmlFor="theme-toggle"
              className="text-base text-[var(--ls-text)] lowercase cursor-pointer"
            >
              theme
            </label>
            <div className="flex items-center gap-3">
              <Switch
                id="theme-toggle"
                checked={theme === 'light'}
                onCheckedChange={handleThemeToggle}
                className="data-[state=checked]:bg-[var(--ls-sand)]"
              />
              <span className="text-sm text-[var(--ls-text-muted)] lowercase w-10">
                {theme === 'light' ? 'light' : 'dark'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
