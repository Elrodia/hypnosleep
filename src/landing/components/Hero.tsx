import { Play, Pause, Sparkles } from 'lucide-react'
import { Button } from './shared/Button'
import { useAudioPreview } from '../hooks/useAudioPreview'
import { posthog } from '../lib/posthog'

interface HeroProps {
  onCtaClick: (location: string) => void
}

export function Hero({ onCtaClick }: HeroProps) {
  // Hardcoded sample per spec. The file may 404 in dev — the hook handles that.
  const { isPlaying, toggle, error } = useAudioPreview('/audio/sample.mp3', 15)

  const handleSample = () => {
    posthog.capture('landing_sample_clicked', { playing: !isPlaying })
    toggle()
  }

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="ls-aurora" aria-hidden />
      <div className="ls-stars" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-12 lg:gap-16 items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[color:var(--ls-text-secondary)]">
            <Sparkles size={14} className="text-[color:var(--ls-gold)]" />
            AI-crafted hypnosis, personalised to you
          </p>

          <h1 className="ls-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-5">
            Rewire Your Mind
            <br />
            <span className="bg-gradient-to-r from-[#a78bfa] via-[#7c5cfc] to-[#5b8def] bg-clip-text text-transparent">
              While You Sleep
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[color:var(--ls-text-secondary)] max-w-xl leading-relaxed mb-8">
            AI-generated hypnosis sessions, personalized to you, in 30 seconds. Sleep deeper,
            build confidence, break habits — without therapy fees.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Only ONE primary CTA per spec anti-pattern: don't compete for attention. */}
            <Button size="lg" pulse onClick={() => onCtaClick('hero_primary')}>
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={handleSample}
              aria-label={isPlaying ? 'Pause sample' : 'Listen to 15 second sample'}
              leadingIcon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
            >
              {isPlaying ? 'Pause Sample' : 'Listen to Sample'}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-[color:var(--ls-text-secondary)] mb-4" role="status">
              {error} — please try again later.
            </p>
          )}

          <p className="text-sm text-[color:var(--ls-text-secondary)]">
            7-day free trial · no credit card · cancel anytime
          </p>
        </div>

        {/* Morphing hypnotic orb — pure CSS, no asset request. */}
        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="ls-orb" role="img" aria-label="Hypnotic orb animation">
            <div className="ls-orb-glow" aria-hidden />
            <div className="ls-orb-inner" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  )
}
