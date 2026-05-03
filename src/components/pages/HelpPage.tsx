import { CaretLeft } from '@phosphor-icons/react'

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
    a: 'Free accounts get a small monthly allowance to try the app. Pro removes the cap, unlocks all premium voices, and lets you generate longer sessions.',
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

const STYLES = `
.ls-help {
  --ls-bg: #0a0a0f;
  --ls-bg-elevated: #12121a;
  --ls-text: #e8e6e1;
  --ls-text-muted: #8a8580;
  --ls-text-subtle: #5a5650;
  --ls-sand: #c9b6a3;
  --ls-sand-dim: #8a7d6e;
  --ls-border: rgba(232, 230, 225, 0.08);
  --ls-border-strong: rgba(232, 230, 225, 0.16);
  font-family: 'Inter', system-ui, sans-serif;
}
.ls-help .font-fraunces {
  font-family: 'Fraunces', 'Cormorant Garamond', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}
`

export function HelpPage({ onBack }: HelpPageProps) {
  return (
    <div className="ls-help min-h-screen bg-[var(--ls-bg)] text-[var(--ls-text)]">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-10 bg-[var(--ls-bg)] border-b border-[var(--ls-border)]">
        <div className="flex items-center gap-3 h-14 px-6">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--ls-text-muted)] hover:text-[var(--ls-text)] transition-colors"
            aria-label="back"
          >
            <CaretLeft className="w-5 h-5" weight="regular" />
          </button>
          <h1 className="font-fraunces italic lowercase text-xl text-[var(--ls-text)]">
            help
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 pt-8 pb-24 space-y-8">
        <section className="space-y-1">
          <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
            questions
          </h2>
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group border-b border-[var(--ls-border)] py-4"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none select-none text-base text-[var(--ls-text)] lowercase">
                <span className="pr-4">{item.q.toLowerCase()}</span>
                <span className="text-[var(--ls-text-muted)] text-lg leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-3 text-sm text-[var(--ls-text-muted)] leading-relaxed">
                {item.a}
              </p>
            </details>
          ))}
        </section>

        <section className="space-y-3 pt-2">
          <h2 className="text-xs uppercase tracking-widest text-[var(--ls-text-subtle)] mb-3">
            contact
          </h2>
          <p className="text-sm text-[var(--ls-text-muted)] leading-relaxed">
            still stuck? email us and a human will reply within one business day.
          </p>
          <a
            href="mailto:support@hypnosleep.app?subject=HypnoSleep%20support"
            className="inline-block text-sm text-[var(--ls-sand)] underline-offset-4 hover:underline lowercase"
          >
            support@hypnosleep.app
          </a>
        </section>
      </div>
    </div>
  )
}
