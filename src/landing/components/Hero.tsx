import { Play, Pause } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './shared/Button'
import { useAudioPreview } from '../hooks/useAudioPreview'
import { posthog } from '../lib/posthog'

interface HeroProps {
  onCtaClick: (location: string) => void
}

export function Hero({ onCtaClick }: HeroProps) {
  const { t } = useTranslation()
  const { isPlaying, toggle, error } = useAudioPreview('/audio/sample.mp3', 15)

  const handleSample = () => {
    posthog.capture('landing_sample_clicked', { playing: !isPlaying })
    toggle()
  }

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24 bg-[var(--ls-bg)]"
    >
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-12 lg:gap-16 items-center">
        <div>
          <p className="mb-6 inline-flex items-center text-xs uppercase tracking-widest text-[var(--ls-text-subtle)]">
            {t('hero.eyebrow')}
          </p>

          <h1 className="font-fraunces italic lowercase text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mb-6 text-[var(--ls-text)]">
            {t('hero.titleLine1')}
            <br />
            {t('hero.titleLine2')}
          </h1>

          <p className="text-base sm:text-lg text-[var(--ls-text-muted)] max-w-xl leading-relaxed mb-8">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Button size="lg" onClick={() => onCtaClick('hero_primary')}>
              {t('hero.ctaPrimary')}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={handleSample}
              aria-label={isPlaying ? t('hero.ariaSamplePause') : t('hero.ariaSamplePlay')}
              leadingIcon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
            >
              {isPlaying ? t('hero.samplePause') : t('hero.samplePlay')}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-[var(--ls-text-muted)] mb-4" role="status">
              {t('hero.errorRetry', { error })}
            </p>
          )}

          <p className="text-sm text-[var(--ls-text-subtle)]">
            {t('hero.trialBullets')}
          </p>
        </div>

        <div className="relative flex items-center justify-center lg:justify-end">
          <div className="ls-orb" role="img" aria-label={t('hero.ariaOrb')}>
            <div className="ls-orb-glow" aria-hidden />
            <div className="ls-orb-inner" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  )
}
