import { Twitter, Instagram, Youtube } from 'lucide-react'
import { Logo } from '../../components/Logo'

interface FooterLink {
  label: string
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
const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features', live: true },
      { label: 'Pricing', href: '#pricing', live: true },
      { label: 'Templates', href: '#templates', live: true },
      { label: 'Roadmap', href: '/roadmap' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about', live: true },
      { label: 'Blog', href: '/blog' },
      { label: 'Press Kit', href: '/press' },
      { label: 'Contact', href: 'mailto:hello@hypnosleep.app', live: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '/help', live: true },
      { label: 'API', href: '/docs/api' },
      { label: 'Affiliates', href: '/affiliates' },
      { label: 'Sitemap', href: '/sitemap.xml' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms', href: '/legal/terms', live: true },
      { label: 'Privacy', href: '/legal/privacy', live: true },
      { label: 'Cookies', href: '/legal/cookies', live: true },
      { label: 'GDPR', href: '/legal/gdpr' },
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
  return (
    <footer className="relative border-t border-[var(--ls-border)] pt-16 pb-10 text-sm">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        {columns.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--ls-text-subtle)]">
              {c.title}
            </h4>
            <ul className="space-y-2">
              {c.links.map((link) => (
                <li key={link.label}>
                  {link.live ? (
                    <a
                      href={link.href}
                      className="text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <span className="text-[var(--ls-text-muted)]/60" title="Coming soon">
                      {link.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between border-t border-[var(--ls-border)] pt-6">
        <div className="flex items-center gap-2">
          <Logo variant="mark" size={28} className="rounded-full" alt="" />
          <span className="ls-display text-base text-[var(--ls-text)]">HypnoSleep</span>
          <span className="ml-3 text-xs text-[var(--ls-text-muted)]">
            © {new Date().getFullYear()} HypnoSleep. Made with <span aria-label="love" className="text-[var(--ls-sand)]">❤</span> in Belgium.
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
