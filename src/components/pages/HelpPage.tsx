import { CaretLeft, EnvelopeSimple, Question } from '@phosphor-icons/react'

interface HelpPageProps {
  onBack: () => void
}

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do hypnosis sessions work?',
    a: 'Each session is generated from your prompt and then read back to you in a calm, guided voice over an optional ambient background. Listen with headphones in a quiet space — most users prefer to lie down with eyes closed.',
  },
  {
    q: 'Are hypnosis sessions safe?',
    a: 'Self-hypnosis recordings are generally considered safe for relaxation and behaviour change. They are not a substitute for professional medical or psychological care. Avoid listening while driving or operating machinery.',
  },
  {
    q: 'How many sessions can I create?',
    a: 'Free accounts can generate a limited number of sessions per month. Pro removes the cap, unlocks all premium voices, and lets you save sessions to your library indefinitely.',
  },
  {
    q: 'Can I edit a generated script?',
    a: 'Yes — open any generated session and tap "Edit script". After editing, tap "Regenerate audio" to re-render the voice track with your changes.',
  },
  {
    q: 'Why did my session fail to generate?',
    a: 'Generation can fail if the prompt requests medical advice, content that could cause harm, or otherwise violates safety guidelines. Try rewriting the prompt to focus on a goal rather than a diagnosis.',
  },
  {
    q: 'How do I cancel my Pro subscription?',
    a: 'Open Profile → Subscription → Cancel subscription. You keep Pro access through the end of your current billing period.',
  },
]

export function HelpPage({ onBack }: HelpPageProps) {
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
          <h1 className="text-lg font-semibold">Help & Support</h1>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Question size={20} weight="duotone" className="text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Frequently asked
            </h2>
          </div>
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {FAQ.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex items-center justify-between cursor-pointer p-4 list-none select-none">
                  <span className="text-sm font-medium pr-4">{item.q}</span>
                  <span className="text-muted-foreground text-lg leading-none transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <EnvelopeSimple size={20} weight="duotone" className="text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contact us
            </h2>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-3">
              Still stuck? Email us and a human will get back to you within one business day.
            </p>
            <a
              href="mailto:support@hypnosleep.app?subject=HypnoSleep%20support"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              support@hypnosleep.app
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
