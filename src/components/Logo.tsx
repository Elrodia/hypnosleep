import { CSSProperties } from 'react'

export type LogoVariant = 'mark' | 'wordmark' | 'full'

export interface LogoProps {
  /**
   * Which rendering of the brand to show:
   * - `mark`: crescent-moon icon only (square)
   * - `wordmark`: mark + "Hypno Sleep" lockup
   * - `full`: mark + wordmark + "REWIRE · RELAX · RESTORE" tagline
   */
  variant?: LogoVariant
  /**
   * Size of the logo:
   * - For `mark`: pixel edge of the square (width = height = size)
   * - For `wordmark` / `full`: pixel *height* of the lockup; width is computed from the
   *   intrinsic aspect ratio so there is no CLS.
   * Accepts a number (px) or any CSS length string (e.g. `"2rem"`, `"100%"`).
   */
  size?: number | string
  className?: string
  style?: CSSProperties
  /** Override the alt text. Defaults to "HypnoSleep". */
  alt?: string
  /** Loading strategy for the underlying `<img>`. Defaults to `"eager"` for above-the-fold usage. */
  loading?: 'eager' | 'lazy'
}

// Source intrinsic dimensions of the PNGs under /public. Kept in sync with
// scripts/gen-logo (reproducible generator) so `width`/`height` attributes
// correctly reserve space and prevent layout shift.
const INTRINSIC: Record<LogoVariant, { src: string; w: number; h: number }> = {
  mark: { src: '/logo-mark.png', w: 1024, h: 1024 },
  wordmark: { src: '/logo-wordmark.png', w: 2048, h: 1024 },
  full: { src: '/logo.png', w: 2048, h: 1280 },
}

/**
 * Centralised brand logo. Rendering the HypnoSleep logo goes through this
 * component everywhere so the artwork can be swapped by dropping new files
 * into `public/` without touching any call sites.
 */
export function Logo({
  variant = 'wordmark',
  size,
  className,
  style,
  alt = 'HypnoSleep',
  loading = 'eager',
}: LogoProps) {
  const { src, w, h } = INTRINSIC[variant]

  let sizedStyle: CSSProperties = {}
  if (variant === 'mark') {
    if (size !== undefined) {
      const v = typeof size === 'number' ? `${size}px` : size
      sizedStyle = { width: v, height: v }
    }
  } else if (size !== undefined) {
    const v = typeof size === 'number' ? `${size}px` : size
    // Height-controlled; width stays auto-proportional via aspect-ratio.
    sizedStyle = { height: v, width: 'auto', aspectRatio: `${w} / ${h}` }
  }

  return (
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      loading={loading}
      decoding="async"
      draggable={false}
      className={className}
      style={{ ...sizedStyle, ...style }}
    />
  )
}

export default Logo
