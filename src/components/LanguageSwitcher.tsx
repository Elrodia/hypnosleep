import { useState, useRef, useEffect } from 'react'
import { Globe, Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '@/i18n/config'
import { useAuth } from '@/lib/auth-context'
import { updateProfile } from '@/lib/api-endpoints'

interface LanguageSwitcherProps {
  /** Visual variant — controls sizing and label visibility. */
  variant?: 'default' | 'compact'
  className?: string
}

/**
 * Language picker rendered in three places: the landing nav, the
 * login page, and the Preferences sub-page.
 *
 * - Anonymous: persists choice to localStorage only (handled by the
 *   `i18next-browser-languagedetector` cache).
 * - Authenticated: also patches `users.preferences.language` so the
 *   choice follows the user across devices.
 *
 * The current language is shown as a 2-letter code (EN / FR / PT /
 * ES / DE / IT) next to the globe icon. The dropdown lists each
 * option with its native name (English, Français, Português, etc.)
 * — the native-name pattern lets a user identify their language
 * even when they currently see another one.
 */
export function LanguageSwitcher({ variant = 'default', className = '' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const resolved = (i18n.resolvedLanguage ?? 'en') as string
  const currentLang: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(
    resolved,
  )
    ? (resolved as SupportedLanguage)
    : 'en'
  const currentLabel = LANGUAGE_LABELS[currentLang]

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = async (lang: SupportedLanguage) => {
    setIsOpen(false)
    if (lang === currentLang) return

    await i18n.changeLanguage(lang)

    if (user) {
      // Best-effort sync to backend. We don't block on it; the
      // localStorage write that i18next-browser-languagedetector
      // performs is the source of truth on this device.
      updateProfile({ preferences: { language: lang } }).catch(() => {
        // Silent — the user's UI already reflects the change.
        // Next refresh, /api/auth/me will return the previous
        // server value if this PATCH never landed; the
        // localStorage value will then be used.
      })
    }
  }

  const sizeClasses =
    variant === 'compact' ? 'h-8 px-2 text-xs gap-1.5' : 'h-9 px-3 text-sm gap-2'

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`${sizeClasses} flex items-center rounded-md border border-[var(--ls-border-strong)] bg-transparent text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:border-[var(--ls-sand-dim)] transition-colors lowercase focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ls-sand-dim)]`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={currentLabel.native}
      >
        <Globe size={variant === 'compact' ? 14 : 16} weight="regular" />
        <span>{currentLabel.code}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[160px] rounded-md border border-[var(--ls-border-strong)] bg-[var(--ls-bg-elevated)] py-1 shadow-none z-50"
          role="listbox"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const label = LANGUAGE_LABELS[lang]
            const isSelected = lang === currentLang
            return (
              <button
                key={lang}
                type="button"
                onClick={() => handleSelect(lang)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? 'text-[var(--ls-sand)]'
                    : 'text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] hover:bg-[var(--ls-bg)]/40'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span>{label.native}</span>
                {isSelected && <Check size={14} weight="regular" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
