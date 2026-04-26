import { useState } from 'react'
import { CaretLeft, Moon, Sun } from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useKV } from '@/hooks/use-kv'
import { toast } from 'sonner'

// Voice ids match the backend `VOICES` registry (Azure TTS names) so
// the value the user picks here is the same value the Create screen
// sends to `/api/sessions/generate` — no display-to-id mapping needed.
const VOICE_OPTIONS = [
  { value: 'en-US-AnaNeural', label: 'Calm Female' },
  { value: 'en-US-GuyNeural', label: 'Deep Male' },
  { value: 'en-US-AriaNeural', label: 'Soft Whisper (Pro)' },
  { value: 'en-GB-SoniaNeural', label: 'Gentle British (Pro)' },
  { value: 'en-AU-NatashaNeural', label: 'Warm Australian (Pro)' },
]

// Background ids match the backend `BACKGROUND_SOUNDS` enum.
const BACKGROUND_SOUND_OPTIONS = [
  { value: 'rain', label: 'Rain' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'wind', label: 'Wind' },
  { value: 'silence', label: 'Silence' },
]

const SESSION_LENGTH_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
]

interface PreferencesPageProps {
  onBack?: () => void
}

export function PreferencesPage({ onBack }: PreferencesPageProps) {
  const [dailyReminderEnabled, setDailyReminderEnabled] = useKV<boolean>('daily-reminder-enabled', false)
  const [reminderTime, setReminderTime] = useKV<string>('reminder-time', '22:00')
  const [defaultSessionLength, setDefaultSessionLength] = useKV<string>('default-session-length', '10')
  const [defaultVoice, setDefaultVoice] = useKV<string>('default-voice', 'en-US-AnaNeural')
  const [backgroundSound, setBackgroundSound] = useKV<string>('background-sound', 'rain')
  const [theme, setTheme] = useKV<'dark' | 'light'>('theme', 'dark')

  const handleDailyReminderToggle = (checked: boolean) => {
    setDailyReminderEnabled(checked)
    if (checked) {
      toast.success('Daily reminder enabled')
    } else {
      toast('Daily reminder disabled')
    }
  }

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
    toast.success(`${newTheme === 'dark' ? 'Dark' : 'Light'} theme activated`)
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReminderTime(e.target.value)
  }

  return (
    <div className="min-h-screen pb-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-accent/50 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Go back"
          >
            <CaretLeft className="w-6 h-6 text-foreground" weight="bold" />
          </button>
          <h1 className="text-lg font-semibold">Preferences</h1>
        </div>
      </div>

      <div className="p-6 space-y-1">
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between p-4 min-h-[68px]">
            <div className="flex-1">
              <label htmlFor="daily-reminder" className="text-sm font-medium cursor-pointer">
                Daily Reminder
              </label>
            </div>
            <Switch
              id="daily-reminder"
              checked={dailyReminderEnabled ?? false}
              onCheckedChange={handleDailyReminderToggle}
            />
          </div>

          {dailyReminderEnabled && (
            <div className="flex items-center justify-between p-4 min-h-[68px]">
              <div className="flex-1">
                <label htmlFor="reminder-time" className="text-sm font-medium cursor-pointer">
                  Reminder Time
                </label>
              </div>
              <input
                id="reminder-time"
                type="time"
                value={reminderTime ?? '22:00'}
                onChange={handleTimeChange}
                className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-[3px] focus:ring-ring/50 focus:border-ring transition-all"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-4 min-h-[68px]">
            <div className="flex-1">
              <label htmlFor="session-length" className="text-sm font-medium">
                Default Session Length
              </label>
            </div>
            <Select
              value={defaultSessionLength ?? '10'}
              onValueChange={setDefaultSessionLength}
            >
              <SelectTrigger id="session-length" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_LENGTH_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 min-h-[68px]">
            <div className="flex-1">
              <label htmlFor="default-voice" className="text-sm font-medium">
                Default Voice
              </label>
            </div>
            <Select
              value={defaultVoice ?? 'calm-female'}
              onValueChange={setDefaultVoice}
            >
              <SelectTrigger id="default-voice" className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 min-h-[68px]">
            <div className="flex-1">
              <label htmlFor="background-sound" className="text-sm font-medium">
                Background Sound
              </label>
            </div>
            <Select
              value={backgroundSound ?? 'rain'}
              onValueChange={setBackgroundSound}
            >
              <SelectTrigger id="background-sound" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BACKGROUND_SOUND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 min-h-[68px]">
            <div className="flex-1 flex items-center gap-2">
              <label htmlFor="theme-toggle" className="text-sm font-medium cursor-pointer">
                Theme
              </label>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" weight="fill" />
                Dark
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="theme-toggle"
                checked={theme === 'light'}
                onCheckedChange={handleThemeToggle}
              />
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" weight="fill" />
                Light
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
