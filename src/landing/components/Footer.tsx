import { Twitter, Instagram, Youtube } from 'lucide-react'
import { Logo } from '../../components/Logo'

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
                  {/* Placeholders for pre-launch — rendered as non-interactive
                      text so clicking doesn't jump to the top of the page or
                      pollute browser history with `#` entries. Swap to real
                      <a> tags as destinations come online. */}
                  <span className="text-[color:var(--ls-text-secondary)]">
                    {l}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          <Logo variant="mark" size={28} className="rounded-full" alt="" />
          <span className="ls-display text-base">HypnoSleep</span>
          <span className="ml-3 text-xs text-[color:var(--ls-text-secondary)]">
            © 2026 HypnoSleep. Made with <span aria-label="love">❤️</span> in Belgium.
          </span>
        </div>

        <ul className="flex items-center gap-2">
          {[
            { label: 'X (Twitter)', icon: Twitter },
            { label: 'TikTok', icon: null },
            { label: 'Instagram', icon: Instagram },
            { label: 'YouTube', icon: Youtube },
          ].map((s) => {
            const Icon = s.icon
            return (
              <li key={s.label}>
                {/* Social destinations aren't live yet — render as a non-
                    interactive badge rather than an `href="#"` link that
                    would scroll to the top and dirty the history stack. */}
                <span
                  aria-label={s.label}
                  role="img"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"
                >
                  {Icon ? <Icon size={16} /> : (
                    // TikTok glyph — lucide doesn't ship a first-class icon.
                    <span className="ls-display text-sm">t</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </footer>
  )
}
