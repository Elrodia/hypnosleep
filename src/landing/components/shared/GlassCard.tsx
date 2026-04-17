import type { HTMLAttributes, ReactNode } from 'react'

export function GlassCard({
  children,
  className = '',
  highlighted = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; highlighted?: boolean }) {
  return (
    <div
      className={
        'relative rounded-2xl border backdrop-blur-xl transition ' +
        (highlighted
          ? 'border-[color:var(--ls-primary)]/60 bg-[color:var(--ls-surface)]/70 shadow-[0_30px_80px_-40px_rgba(124,92,252,0.5)]'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]') +
        ' ' +
        className
      }
      {...rest}
    >
      {children}
    </div>
  )
}
