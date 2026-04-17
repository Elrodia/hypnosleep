import type { ReactNode } from 'react'

type Tone = 'default' | 'gold' | 'primary' | 'success'

export function Badge({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  const tones: Record<Tone, string> = {
    default: 'bg-white/5 text-[color:var(--ls-text-secondary)] border-white/10',
    gold: 'bg-[color:var(--ls-gold)]/10 text-[color:var(--ls-gold)] border-[color:var(--ls-gold)]/30',
    primary: 'bg-[color:var(--ls-primary)]/15 text-[color:var(--ls-primary)] border-[color:var(--ls-primary)]/30',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
  }
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide ' +
        tones[tone] +
        ' ' +
        className
      }
    >
      {children}
    </span>
  )
}
