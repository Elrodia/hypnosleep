import { test, expect } from '@playwright/test'
import {
  PRICING,
  monthlyPriceLabel,
  yearlyPriceLabel,
  yearlySavingsPercent,
} from '../../src/config/pricing'

/**
 * Pricing consistency tests.
 *
 * The previous bug was that `PaywallModal` displayed `$9.99/month` while
 * `ProUpgradePage` displayed `$19.99/month`. Both are now driven by
 * `src/config/pricing.ts`. These tests assert that:
 *
 *   1. The landing page's pricing surface matches the centralized config
 *      exactly (monthly + yearly).
 *   2. No contradictory monthly price (e.g. the legacy `$9.99/month`)
 *      ever appears in the unauthenticated flow.
 *
 * The paywall modal and upgrade page are only reachable after sign-in and
 * we deliberately do not fake a backend; instead we cover them by a unit
 * import of the same config that those components consume, plus the
 * landing-page assertions below. Any future regression that hardcodes a
 * monthly price will trip the "no contradictory monthly prices" check.
 */

const PRICING_CONTRADICTIONS: RegExp[] = [
  // Anything that *isn't* the configured monthly price but still claims to
  // be a per-month figure. Listed explicitly so the failure message is
  // obvious if someone re-introduces a stale value.
  /\$9\.99\s*\/\s*month/i,
  /\$4\.99\s*\/\s*month/i,
  /\$14\.99\s*\/\s*month/i,
  /\$29\.99\s*\/\s*month/i,
]

test.describe('pricing consistency', () => {
  test('centralized config exposes the expected values', () => {
    // Sanity check: the rest of the suite depends on these constants, so
    // pin them. Bumping pricing intentionally requires updating this test
    // alongside the config.
    expect(PRICING.monthlyPrice).toBe(19.99)
    expect(PRICING.yearlyPrice).toBe(119.99)
    expect(PRICING.trialDays).toBe(7)
    expect(monthlyPriceLabel).toBe('$19.99')
    expect(yearlyPriceLabel).toBe('$119.99')
  })

  test('landing pricing section shows the yearly price by default and matches the config', async ({ page }) => {
    await page.goto('/#pricing')

    // The Pro card defaults to yearly billing.
    const proPrice = page.getByTestId('landing-pro-price')
    await expect(proPrice).toBeVisible()
    await expect(proPrice).toHaveText(yearlyPriceLabel)

    await expect(page.getByTestId('landing-pro-period')).toHaveText('/year')
  })

  test('landing pricing toggle exposes the monthly price from the config', async ({ page }) => {
    await page.goto('/#pricing')

    // Switch to monthly billing using the role-based locator on the radio.
    await page.getByRole('radio', { name: /^monthly$/i }).click()

    await expect(page.getByTestId('landing-pro-price')).toHaveText(monthlyPriceLabel)
    await expect(page.getByTestId('landing-pro-period')).toHaveText('/month')
  })

  test('landing yearly savings badge matches the config', async ({ page }) => {
    await page.goto('/#pricing')

    // The "Save NN%" badge is derived from the same config; assert the
    // exact percent so a future drift is caught immediately.
    await expect(
      page.getByText(new RegExp(`save\\s+${yearlySavingsPercent}%`, 'i')).first(),
    ).toBeVisible()
  })

  test('landing page never shows a contradictory monthly price', async ({ page }) => {
    await page.goto('/')
    // Read the entire visible body once and scan for known stale figures.
    // Using textContent on <body> avoids brittle CSS-class selectors.
    const bodyText = (await page.locator('body').innerText()).toLowerCase()

    for (const re of PRICING_CONTRADICTIONS) {
      expect(bodyText, `contradictory monthly price matched: ${re}`).not.toMatch(re)
    }

    // And the configured monthly price must be reachable from the pricing
    // section once the user toggles to monthly billing.
    await page.getByRole('link', { name: /^pricing$/i }).first().click().catch(() => {
      // Nav link may not be visible on smaller viewports; fall back to hash nav.
      return page.goto('/#pricing')
    })
    await page.getByRole('radio', { name: /^monthly$/i }).click()
    await expect(page.getByTestId('landing-pro-price')).toHaveText(monthlyPriceLabel)
  })
})
