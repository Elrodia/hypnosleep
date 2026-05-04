/**
 * Use-case IDs surfaced on the landing page.
 *
 * Labels and descriptions are NOT stored here — they live in
 * `src/i18n/locales/<lang>.json` under `useCases.items.<id>.label`
 * and `useCases.items.<id>.description`, so the JSON file is the
 * single source of truth for translatable copy.
 */
export const USE_CASE_IDS = ['sleep', 'confidence', 'smoking', 'anxiety', 'focus'] as const

export type UseCaseId = (typeof USE_CASE_IDS)[number]

export interface Testimonial {
  name: string
  role: string
  quote: string
}
