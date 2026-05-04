/**
 * FAQ entry IDs surfaced on the landing page.
 *
 * Question and answer copy is NOT stored here — it lives in
 * `src/i18n/locales/<lang>.json` under `faq.items.<id>.question`
 * and `faq.items.<id>.answer`, so the JSON file is the single
 * source of truth for translatable copy.
 */
export const FAQ_IDS = [
  'different',
  'works',
  'safe',
  'speed',
  'cancel',
  'refund',
  'privacy',
  'languages',
] as const

export type FaqId = (typeof FAQ_IDS)[number]
