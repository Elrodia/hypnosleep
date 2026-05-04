import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { ProblemSolution } from './components/ProblemSolution'
import { HowItWorks } from './components/HowItWorks'
import { FeaturesGrid } from './components/FeaturesGrid'
import { UseCases } from './components/UseCases'
import { Pricing } from './components/Pricing'
import { FAQ } from './components/FAQ'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'
import { ExitIntentModal } from './components/ExitIntentModal'
import { Button } from './components/shared/Button'
import { useExitIntent } from './hooks/useExitIntent'
import { useScrollDepth } from './hooks/useScrollDepth'
import { posthog } from './lib/posthog'
import { PRICING } from '@/config/pricing'
import { FAQ_IDS } from './data/faqs'
import './styles/landing.css'

interface LandingPageProps {
  /**
   * Called when the visitor asks to start the trial / sign in. The wrapping
   * app decides whether to route to `/signup?plan=...` or open the OAuth
   * modal directly. We keep the landing page agnostic of routing so it can
   * be lifted into its own Next.js app unchanged.
   */
  onStartTrial: (opts: { location: string; plan?: 'free' | 'pro' }) => void
  onLogin: () => void
}

const EXIT_INTENT_KEY = 'hs_landing_exit_shown'

export function LandingPage({ onStartTrial, onLogin }: LandingPageProps) {
  const { t } = useTranslation()
  useScrollDepth()

  const [exitOpen, setExitOpen] = useState(false)

  const trackCTA = useCallback(
    (location: string, plan?: 'free' | 'pro') => {
      posthog.capture('landing_cta_clicked', { location, plan })
      onStartTrial({ location, plan })
    },
    [onStartTrial],
  )

  // Exit-intent modal is a one-shot per session (sessionStorage, per spec).
  const handleExitIntent = useCallback(() => {
    try {
      if (sessionStorage.getItem(EXIT_INTENT_KEY)) return
      sessionStorage.setItem(EXIT_INTENT_KEY, '1')
    } catch {
      /* storage may be blocked — in that case we just show the modal once */
    }
    setExitOpen(true)
  }, [])
  useExitIntent(handleExitIntent)

  // Inject Schema.org JSON-LD into <head>. Keeping it in the component means
  // the SEO payload ships with the landing route only — not dragged into the
  // in-app bundle when the user is logged in.
  useEffect(() => {
    const softwareApp = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'HypnoSleep',
      operatingSystem: 'Web, iOS, Android',
      applicationCategory: 'LifestyleApplication',
      offers: [
        { '@type': 'Offer', price: String(PRICING.freePrice), priceCurrency: 'USD', name: 'Free' },
        { '@type': 'Offer', price: PRICING.yearlyPrice.toFixed(2), priceCurrency: 'USD', name: 'Pro Yearly' },
      ],
    }
    const faqPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_IDS.map((id) => ({
        '@type': 'Question',
        name: t(`faq.items.${id}.question`),
        acceptedAnswer: { '@type': 'Answer', text: t(`faq.items.${id}.answer`) },
      })),
    }
    const node = document.createElement('script')
    node.type = 'application/ld+json'
    node.text = JSON.stringify([softwareApp, faqPage])
    node.dataset.landing = 'true'
    document.head.appendChild(node)
    return () => { document.head.removeChild(node) }
  }, [t])

  return (
    <div className="ls-scope ls-has-sticky-cta">
      <a
        href="#ls-main"
        className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 rounded-md bg-[color:var(--ls-primary)] px-3 py-1.5 text-sm text-white"
      >
        Skip to content
      </a>

      <Nav onCtaClick={trackCTA} onLogin={onLogin} />

      <main id="ls-main" className="relative z-10">
        <Hero onCtaClick={(l) => trackCTA(l)} />
        <ProblemSolution />
        <HowItWorks />
        <FeaturesGrid />
        <UseCases onCtaClick={(l) => trackCTA(l)} />
        <Pricing onCtaClick={(l, p) => trackCTA(l, p)} />
        <FAQ />
        <FinalCTA onCtaClick={(l) => trackCTA(l)} />
      </main>

      <Footer />

      {/* Mobile sticky CTA bar — single action so there is never any question
          about what the "main" thing to do is on a small screen. */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 p-3 pt-4 bg-gradient-to-t from-[color:var(--ls-bg)] via-[color:var(--ls-bg)]/95 to-transparent">
        <Button
          size="lg"
          className="w-full"
          onClick={() => trackCTA('mobile_sticky')}
        >
          Start Free Trial
        </Button>
      </div>

      <ExitIntentModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onCtaClick={(l) => trackCTA(l)}
      />
    </div>
  )
}

export default LandingPage
