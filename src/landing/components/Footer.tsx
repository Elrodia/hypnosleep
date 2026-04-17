import { Moon, Twitter, Instagram, Youtube } from 'lucide-react'

const columns: { title: string; links: string[] }[] = [
  { title: 'Product', links: ['Features', 'Pricing', 'Templates', 'Roadmap'] },
  { title: 'Company', links: ['About', 'Blog', 'Press Kit', 'Contact'] },
  { title: 'Resources', links: ['Help Center', 'API', 'Affiliates', 'Sitemap'] },
  { title: 'Legal', links: ['Terms', 'Privacy', 'Cookies', 'GDPR'] },
]

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 pt-16 pb-10 text-sm">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        {columns.map((c) => (
          <div key={c.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ls-text-secondary)]">
              {c.title}
            </h4>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l}>
                  <a
                    href="#"
                    className="text-[color:var(--ls-text-secondary)] hover:text-[color:var(--ls-text)] transition"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#7c5cfc] to-[#5b8def] text-white"
          >
            <Moon size={14} strokeWidth={2.2} />
          </span>
          <span className="ls-display text-base">HypnoSleep</span>
          <span className="ml-3 text-xs text-[color:var(--ls-text-secondary)]">
            © 2026 HypnoSleep. Made with <span aria-label="love">❤️</span> in Belgium.
          </span>
        </div>

        <ul className="flex items-center gap-2">
          {[
            { label: 'X (Twitter)', icon: Twitter, href: '#' },
            { label: 'TikTok', icon: null, href: '#' },
            { label: 'Instagram', icon: Instagram, href: '#' },
            { label: 'YouTube', icon: Youtube, href: '#' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <li key={s.label}>
                <a
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
                >
                  {Icon ? <Icon size={16} /> : (
                    // TikTok glyph — lucide doesn't ship a first-class icon.
                    <span className="ls-display text-sm">t</span>
                  )}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </footer>
  )
}
