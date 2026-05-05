import { CaretLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface HelpPageProps {
  onBack: () => void
}

const FAQ_KEYS = ['sessions', 'audio', 'data', 'billing'] as const

const STYLES = `
.ls-help {
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
.ls-help .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function HelpPage({ onBack }: HelpPageProps) {
  const { t } = useTranslation()
  return (
    <div className="ls-help min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-10 bg-[var(--ls-bg)] border-b border-[var(--ls-border)]">
        <div className="flex items-center gap-3 h-14 px-6">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
            aria-label={t('sessionDetail.ariaBack')}
          >
            <CaretLeft className="w-5 h-5" weight="regular" />
          </button>
          <h1 className="font-fraunces italic lowercase text-xl text-[var(--ls-text)]">
            {t('help.title')}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8 pb-24 space-y-8">
        <section className="space-y-1">
          <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
            {t('help.questionsHeader')}
          </h2>
          {FAQ_KEYS.map((key) => (
            <details
              key={key}
              className="group border-b border-[var(--ls-border)] py-4"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none select-none text-base text-[var(--ls-text)] lowercase">
                <span className="pr-4">{t(`help.items.${key}.q`).toLowerCase()}</span>
                <span className="text-[var(--ls-text-muted)] text-lg leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-3 text-sm text-[var(--ls-text-muted)] leading-relaxed">
                {t(`help.items.${key}.a`)}
              </p>
            </details>
          ))}
        </section>

        <section className="space-y-3 pt-2">
          <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
            {t('help.contactHeader')}
          </h2>
          <p className="text-sm text-[var(--ls-text-muted)] leading-relaxed">
            {t('help.contactBody')}
          </p>
          <a
            href="mailto:support@hypnosleep.app?subject=HypnoSleep%20support"
            className="inline-block text-sm text-[var(--ls-sand)] underline-offset-4 hover:underline lowercase"
          >
            support@hypnosleep.app
          </a>
        </section>
      </div>
    </div>
  )
}
