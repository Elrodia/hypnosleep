import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  /**
   * Retained for backward compatibility with call sites authored before the
   * Liminal Space migration. The flat hairline treatment is the same for
   * both states; the prop is accepted but no longer alters the visual.
   */
  highlighted?: boolean
}

/**
 * Liminal-Space card: hairline border on slightly elevated background, no
 * blur, no glow. The component name is retained for backward compatibility
 * — the "glass" treatment is gone but the API is preserved so call sites
 * don't need to change.
 */
export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <div
      className={`rounded-md border border-[var(--ls-border)] bg-[var(--ls-bg-elevated)] ${className}`}
    >
      {children}
    </div>
  )
}
