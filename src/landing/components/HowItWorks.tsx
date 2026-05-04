import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { GlassCard } from './shared/GlassCard'

// "Screenshot" placeholders — we draw stylised mockups in pure CSS instead
// of shipping PNGs. Keeps LCP fast and means the visuals never drift from
// the real app colour palette.
function CreateMock() {
  const { t } = useTranslation()
  const tags = [t('howItWorks.step1Tag1'), t('howItWorks.step1Tag2'), t('howItWorks.step1Tag3')]
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-4 border border-[var(--ls-border)] text-left">
      <div className="text-xs text-[var(--ls-text-muted)] mb-2">{t('howItWorks.step1Caption')}</div>
      <div className="rounded-lg bg-[var(--ls-bg)] border border-[var(--ls-border)] px-3 py-2 text-sm">
        <span className="text-[var(--ls-text)]">{t('howItWorks.step1Sample')}</span>
        <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-[var(--ls-sand)]" aria-hidden />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full border border-[var(--ls-border-strong)] px-2.5 py-1 text-[var(--ls-text-muted)]">{tag}</span>
        ))}
      </div>
    </div>
  )
}

function GenerateMock() {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-5 border border-[var(--ls-border)] text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full border-2 border-[var(--ls-border-strong)] border-t-[var(--ls-sand)] animate-spin" aria-hidden />
      <div className="text-sm text-[var(--ls-text)]">{t('howItWorks.step2Caption')}</div>
      <div className="mt-1 text-xs text-[var(--ls-text-muted)]">{t('howItWorks.step2Sub')}</div>
    </div>
  )
}

function PlayerMock() {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl bg-[var(--ls-bg-elevated)] p-5 border border-[var(--ls-border)]">
      <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-[var(--ls-sand)]" aria-hidden />
      <div className="text-sm font-medium mb-1 text-[var(--ls-text)]">{t('howItWorks.step3SessionTitle')}</div>
      <div className="text-xs text-[var(--ls-text-muted)] mb-3">{t('howItWorks.step3SessionMeta')}</div>
      <div className="h-1 rounded-full bg-[var(--ls-border-strong)] overflow-hidden">
        <div className="h-full w-1/3 bg-[var(--ls-sand)]" />
      </div>
    </div>
  )
}

export function HowItWorks() {
  const { t } = useTranslation()
  const steps = [
    { title: t('howItWorks.step1Title'), mock: <CreateMock /> },
    { title: t('howItWorks.step2Title'), mock: <GenerateMock /> },
    { title: t('howItWorks.step3Title'), mock: <PlayerMock /> },
  ]

  return (
    <section id="how-it-works" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl mb-14">
          <p className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">{t('howItWorks.eyebrow')}</p>
          <h2 className="font-fraunces italic lowercase text-3xl sm:text-4xl mb-4 text-[var(--ls-text)]">{t('howItWorks.title')}</h2>
          <p className="text-[var(--ls-text-muted)]">
            {t('howItWorks.subtitle')}
          </p>
        </header>

        <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
          {/* Connector line — absolute positioned behind the cards on md+. */}
          <div
            className="hidden md:block absolute top-6 left-[8%] right-[8%] h-px bg-[var(--ls-border-strong)]"
            aria-hidden
          />
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ls-bg)] border border-[var(--ls-sand)] text-[var(--ls-sand)] ls-display text-xl">
                  {i + 1}
                </span>
                <h3 className="ls-display text-xl leading-tight text-[var(--ls-text)]">{s.title}</h3>
              </div>
              <GlassCard className="p-4">{s.mock}</GlassCard>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
