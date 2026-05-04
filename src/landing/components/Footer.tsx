import { Twitter, Instagram, Youtube } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../../components/Logo'

interface FooterLink {
  /** i18n key under `footer.links.*` for the visible label. */
  labelKey: string
  href: string
  /** When true, the link points to a real destination — otherwise it's
      kept as plain text until the destination comes online. Keeping the
      label visible (instead of dropping it) preserves the visual layout
      and signals what's coming. */
  live?: boolean
}

/**
 * Footer link map. Mark entries `live: true` once the destination
 * page exists. Live entries render as real anchors with hover states;
 * the rest fall back to non-interactive text so we don't ship `href="#"`
 * links that scroll to the top and pollute history.
 */
const columns: { titleKey: string; links: FooterLink[] }[] = [
  {
    titleKey: 'footer.product',
    links: [
      { labelKey: 'features', href: '#features', live: true },
      { labelKey: 'pricing', href: '#pricing', live: true },
      { labelKey: 'templates', href: '#templates', live: true },
      { labelKey: 'roadmap', href: '/roadmap' },
    ],
  },
  {
    titleKey: 'footer.company',
    links: [
      { labelKey: 'about', href: '/about', live: true },
      { labelKey: 'blog', href: '/blog' },
      { labelKey: 'pressKit', href: '/press' },
      { labelKey: 'contact', href: 'mailto:hello@hypnosleep.app', live: true },
    ],
  },
  {
    titleKey: 'footer.resources',
    links: [
      { labelKey: 'helpCenter', href: '/help', live: true },
      { labelKey: 'api', href: '/docs/api' },
      { labelKey: 'affiliates', href: '/affiliates' },
      { labelKey: 'sitemap', href: '/sitemap.xml' },
    ],
  },
  {
    titleKey: 'footer.legal',
    links: [
      { labelKey: 'terms', href: '/legal/terms', live: true },
      { labelKey: 'privacy', href: '/legal/privacy', live: true },
      { labelKey: 'cookies', href: '/legal/cookies', live: true },
      { labelKey: 'gdpr', href: '/legal/gdpr' },
    ],
  },
]

const socials: Array<{ label: string; href: string | null; icon: typeof Twitter | null }> = [
  { label: 'X (Twitter)', href: 'https://x.com/hypnosleepapp', icon: Twitter },
  { label: 'TikTok', href: null, icon: null },
  { label: 'Instagram', href: 'https://instagram.com/hypnosleepapp', icon: Instagram },
  { label: 'YouTube', href: null, icon: Youtube },
]

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="relative border-t border-[var(--ls-border)] pt-16 pb-10 text-sm">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        {columns.map((c) => (
          <div key={c.titleKey}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--ls-text-subtle)]">
              {t(c.titleKey)}
            </h4>
            <ul className="space-y-2">
              {c.links.map((link) => {
                const label = t(`footer.links.${link.labelKey}`)
                return (
                  <li key={link.labelKey}>
                    {link.live ? (
                      <a
                        href={link.href}
                        className="text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <span className="text-[var(--ls-text-muted)]/60" title="Coming soon">
                        {label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between border-t border-[var(--ls-border)] pt-6">
        <div className="flex items-center gap-2">
          <Logo variant="mark" size={28} className="rounded-full" alt="" />
          <span className="ls-display text-base text-[var(--ls-text)]">HypnoSleep</span>
          <span className="ml-3 text-xs text-[var(--ls-text-muted)]">
            {t('footer.madeIn', { year: new Date().getFullYear() })}{' '}
            <span aria-label="love" className="text-[var(--ls-sand)]">❤</span>{' '}
            {t('footer.inBelgium')}
          </span>
        </div>

        <ul className="flex items-center gap-2">
          {socials.map((s) => {
            const Icon = s.icon
            const inner = Icon ? <Icon size={16} /> : <span className="ls-display text-sm">t</span>
            const className =
              'flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ls-border-strong)] text-[var(--ls-text-muted)] transition-colors'
            return (
              <li key={s.label}>
                {s.href ? (
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className={`${className} hover:text-[var(--ls-sand)]`}
                  >
                    {inner}
                  </a>
                ) : (
                  <span aria-label={`${s.label} (coming soon)`} role="img" className={`${className} opacity-50`}>
                    {inner}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </footer>
  )
}
