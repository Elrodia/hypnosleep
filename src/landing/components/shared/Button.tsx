import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'
type Size = 'md' | 'lg'

export interface LandingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  pulse?: boolean
}

/**
 * Single CTA primitive for the landing page. We roll our own (rather than
 * reusing the in-app `Button`) so the landing page can ship with the smallest
 * possible style surface and a distinct "marketing" look (gradient, glow).
 */
export const Button = forwardRef<HTMLButtonElement, LandingButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    pulse,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ls-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--ls-bg)] ' +
    'disabled:opacity-60 disabled:cursor-not-allowed select-none whitespace-nowrap'

  const sizes: Record<Size, string> = {
    md: 'px-5 py-2.5 text-sm min-h-[44px]',
    lg: 'px-7 py-3.5 text-base min-h-[52px]',
  }

  const variants: Record<Variant, string> = {
    primary:
      'text-white shadow-[0_10px_40px_-10px_rgba(124,92,252,0.65)] ' +
      'bg-[linear-gradient(135deg,#8a6bff_0%,#7c5cfc_45%,#5b8def_100%)] ' +
      'hover:brightness-110 active:brightness-95',
    secondary:
      'text-[color:var(--ls-text)] bg-white/5 border border-white/10 backdrop-blur ' +
      'hover:bg-white/10',
    ghost:
      'text-[color:var(--ls-text)] bg-transparent hover:bg-white/5',
    outline:
      'text-[color:var(--ls-text)] border border-[color:var(--ls-primary)]/60 ' +
      'hover:bg-[color:var(--ls-primary)]/10',
  }

  return (
    <button
      ref={ref}
      className={`${base} ${sizes[size]} ${variants[variant]} ${pulse ? 'ls-pulse' : ''} ${className}`}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  )
})
