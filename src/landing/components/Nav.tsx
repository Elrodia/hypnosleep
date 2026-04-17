import { useEffect, useState } from 'react'
import { Menu, X, Moon } from 'lucide-react'
import { Button } from './shared/Button'
import { posthog } from '../lib/posthog'

interface NavProps {
  onCtaClick: (location: string) => void
  onLogin: () => void
}

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export function Nav({ onCtaClick, onLogin }: NavProps) {
  // Background fades to opaque once the user has scrolled past the hero —
  // protects nav legibility without fighting the hero gradient above it.
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const go = (href: string) => {
    posthog.capture('landing_nav_clicked', { target: href })
    setDrawerOpen(false)
  }

  return (
    <>
      <header
        className={
          'fixed top-0 inset-x-0 z-40 transition-colors ' +
          (scrolled
            ? 'bg-[color:var(--ls-bg)]/85 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent backdrop-blur-md')
        }
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between px-5 sm:px-8 h-16">
          <a href="#top" className="flex items-center gap-2" aria-label="HypnoSleep home">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7c5cfc] to-[#5b8def] text-white"
            >
              <Moon size={16} strokeWidth={2.2} />
            </span>
            <span className="ls-display text-lg tracking-tight">HypnoSleep</span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm text-[color:var(--ls-text-secondary)]">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => go(l.href)}
                className="hover:text-[color:var(--ls-text)] transition"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm text-[color:var(--ls-text-secondary)] hover:text-[color:var(--ls-text)] transition px-3 py-2"
            >
              Log In
            </button>
            <Button size="md" onClick={() => onCtaClick('nav')}>Start Free Trial</Button>
          </div>

          <button
            type="button"
            className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10"
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((o) => !o)}
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden bg-[color:var(--ls-bg)]/95 backdrop-blur-xl pt-20"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex flex-col gap-2 px-6">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => go(l.href)}
                className="text-2xl ls-display py-3 border-b border-white/5"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-6 flex flex-col gap-3">
              <Button size="lg" onClick={() => { setDrawerOpen(false); onCtaClick('nav_mobile') }}>
                Start Free Trial
              </Button>
              <Button size="lg" variant="secondary" onClick={() => { setDrawerOpen(false); onLogin() }}>
                Log In
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
