import { CaretLeft, Heart } from '@phosphor-icons/react'

interface AboutPageProps {
  onBack: () => void
}

const VERSION = '1.0.0'

export function AboutPage({ onBack }: AboutPageProps) {
  return (
    <div className="min-h-screen pb-12">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full hover:bg-accent/50 flex items-center justify-center transition-colors active:scale-95"
            aria-label="Go back"
          >
            <CaretLeft className="w-6 h-6 text-foreground" weight="bold" />
          </button>
          <h1 className="text-lg font-semibold">About</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section className="text-center pt-2">
          <h2 className="text-2xl font-serif tracking-wide">HypnoSleep</h2>
          <p className="text-xs text-muted-foreground mt-1">Version {VERSION}</p>
        </section>

        <section className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            HypnoSleep generates personalised hypnosis sessions on demand — write what
            you want help with, pick a voice and a length, and we synthesise a guided
            recording you can listen to that same night.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Built with care by a small team that uses the app every day. Made with{' '}
            <Heart weight="fill" className="inline w-3.5 h-3.5 text-red-500 align-text-bottom" />{' '}
            for restful sleep, sharper focus, and gentler self-talk.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Legal
          </h3>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            <a
              href="/legal/privacy"
              className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
            >
              <span className="text-sm font-medium">Privacy Policy</span>
              <span className="text-muted-foreground text-sm">→</span>
            </a>
            <a
              href="/legal/terms"
              className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
            >
              <span className="text-sm font-medium">Terms of Service</span>
              <span className="text-muted-foreground text-sm">→</span>
            </a>
            <a
              href="mailto:support@hypnosleep.app"
              className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
            >
              <span className="text-sm font-medium">Contact</span>
              <span className="text-muted-foreground text-sm">→</span>
            </a>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Acknowledgements
          </h3>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Voices powered by Microsoft Azure Cognitive Services. Background sounds
              are royalty-free field recordings. The script generator runs on
              large-language-model technology guided by safety filters tuned for
              hypnosis content.
            </p>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground/70 pt-4">
          © {new Date().getFullYear()} HypnoSleep. All rights reserved.
        </p>
      </div>
    </div>
  )
}
