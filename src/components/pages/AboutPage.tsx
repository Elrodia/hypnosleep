import { CaretLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface AboutPageProps {
  onBack: () => void
}

const VERSION = '1.0.0'

const STYLES = `
.ls-about {
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
.ls-about .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function AboutPage({ onBack }: AboutPageProps) {
  const { t } = useTranslation()
  return (
    <div className="ls-about min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
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
            {t('about.title')}
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8 pb-24 space-y-8">
        <div className="space-y-10">
          <section className="text-center space-y-2 pt-4">
            <h2 className="font-fraunces italic lowercase text-3xl text-[var(--ls-text)]">
              {t('home.brand')}
            </h2>
            <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
              {t('about.version', { version: VERSION })}
            </p>
          </section>

          <section className="space-y-4">
            <p className="text-sm text-[var(--ls-text)] leading-relaxed">
              {t('about.pitch1')}
            </p>
            <p className="text-sm text-[var(--ls-text-muted)] leading-relaxed">
              {t('about.pitch2')}
            </p>
          </section>

          <section className="space-y-1">
            <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
              {t('about.legalHeader')}
            </h3>
            <a
              href="/legal/privacy"
              className="block py-4 border-b border-[var(--ls-border)] text-base text-[var(--ls-text)] hover:text-[var(--ls-sand)] transition-colors lowercase"
            >
              {t('about.legalPrivacy')}
            </a>
            <a
              href="/legal/terms"
              className="block py-4 border-b border-[var(--ls-border)] text-base text-[var(--ls-text)] hover:text-[var(--ls-sand)] transition-colors lowercase"
            >
              {t('about.legalTerms')}
            </a>
            <a
              href="mailto:support@hypnosleep.app"
              className="block py-4 border-b border-[var(--ls-border)] text-base text-[var(--ls-text)] hover:text-[var(--ls-sand)] transition-colors lowercase"
            >
              {t('about.legalContact')}
            </a>
          </section>

          <section className="space-y-3 pt-2">
            <h3 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
              {t('about.ackHeader')}
            </h3>
            <p className="text-xs text-[var(--ls-text-muted)] leading-relaxed">
              {t('about.ackBody')}
            </p>
          </section>

          <p className="text-center text-xs text-[var(--ls-text-subtle)] pt-4">
            {t('about.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  )
}
