import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'md' | 'lg'

export interface LandingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  /**
   * Retained for API compatibility with older call sites. The Liminal
   * Space migration drops the loud pulse animation; the prop is accepted
   * but no longer alters the visual.
   */
  pulse?: boolean
}

/**
 * Single CTA primitive for the landing page. We roll our own (rather than
 * reusing the in-app `Button`) so the landing page can ship with the smallest
 * possible style surface — Liminal Space hairline / sand fill instead of the
 * legacy violet gradient.
 */
export const Button = forwardRef<HTMLButtonElement, LandingButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    pulse: _pulse,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  // `pulse` is intentionally consumed and ignored — see prop docs above.
  void _pulse

  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ls-sand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ls-bg)] ' +
    'disabled:opacity-60 disabled:cursor-not-allowed select-none whitespace-nowrap'

  const sizes: Record<Size, string> = {
    md: 'px-5 py-2.5 text-sm min-h-[44px]',
    lg: 'px-7 py-3.5 text-base min-h-[52px]',
  }

  const variants: Record<Variant, string> = {
    primary:
      'text-[var(--ls-bg)] bg-[var(--ls-sand)] ' +
      'hover:bg-[var(--ls-sand)]/90 active:brightness-95',
    secondary:
      'text-[var(--ls-text)] bg-[var(--ls-bg-elevated)] border border-[var(--ls-border)] ' +
      'hover:border-[var(--ls-border-strong)]',
    ghost:
      'text-[var(--ls-text)] bg-transparent hover:bg-[var(--ls-bg-elevated)]',
    outline:
      'text-[var(--ls-text-muted)] border border-[var(--ls-sand-dim)] ' +
      'hover:text-[var(--ls-text)] hover:border-[var(--ls-sand)]',
  }

  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
})
