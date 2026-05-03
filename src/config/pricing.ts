/**
 * Single source of truth for all user-facing pricing copy.
 *
 * Any component that displays a price, trial duration, or savings figure
 * MUST import from this file. Hardcoding `$19.99`, `$119.99`, `$9.99`, or
 * trial-day counts in components is a regression and is asserted against
 * by the Playwright pricing E2E tests.
 */

export interface PricingConfig {
  /** Pro plan price in USD per month, when billed monthly. */
  monthlyPrice: number
  /** Pro plan price in USD per year, when billed yearly. */
  yearlyPrice: number
  /** Currency symbol used for display. */
  currencySymbol: string
  /** Free trial length, in days. */
  trialDays: number
  /** Free tier marketing label (e.g. "$0/forever"). */
  freePrice: number
}

export const PRICING: PricingConfig = {
  monthlyPrice: 19.99,
  yearlyPrice: 119.99,
  currencySymbol: '$',
  trialDays: 7,
  freePrice: 0,
}

/** Formatted "$19.99" string for the monthly price. */
export const monthlyPriceLabel = `${PRICING.currencySymbol}${PRICING.monthlyPrice.toFixed(2)}`

/** Formatted "$119.99" string for the yearly price. */
export const yearlyPriceLabel = `${PRICING.currencySymbol}${PRICING.yearlyPrice.toFixed(2)}`

/** What twelve months at the monthly price would cost (used as the strikethrough anchor). */
export const yearlyEquivalentOfMonthly = PRICING.monthlyPrice * 12

/** Dollars saved per year by paying yearly vs. monthly. */
export const yearlySavings = yearlyEquivalentOfMonthly - PRICING.yearlyPrice

/** Percent saved per year by paying yearly vs. monthly (rounded). */
export const yearlySavingsPercent = Math.round(
  (yearlySavings / yearlyEquivalentOfMonthly) * 100,
)

/** "7-day free trial" style copy. */
export const trialCopy = `${PRICING.trialDays}-day free trial`

/** "7 days free" style short copy. */
export const trialShortCopy = `${PRICING.trialDays} days free`
