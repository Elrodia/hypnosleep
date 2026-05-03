import { test, expect } from '@playwright/test'

/**
 * Landing-page smoke tests.
 *
 * These tests are deliberately scoped to the unauthenticated landing page.
 * They never call the API, never authenticate, and never depend on Stripe
 * or OAuth — they only verify that the public marketing surface renders
 * and that its primary CTAs are wired up to *something*.
 */

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the hero with the primary headline and CTA', async ({ page }) => {
    // The hero headline is split across two lines in the markup, so match
    // each fragment independently rather than asserting on the full string.
    await expect(page.getByRole('heading', { name: /Rewire Your Mind/i })).toBeVisible()
    await expect(page.getByText(/While You Sleep/i).first()).toBeVisible()

    // There are several "Start Free Trial" CTAs (hero, nav, sticky, final
    // CTA). Just assert that at least one is rendered and visible.
    const ctas = page.getByRole('button', { name: /start free trial/i })
    await expect(ctas.first()).toBeVisible()
    expect(await ctas.count()).toBeGreaterThan(0)
  })

  test('main hero CTA is actionable and opens the login flow (not dead UI)', async ({ page }) => {
    // Pick the hero CTA specifically — it is the most prominent button on
    // the page and the one a brand-new visitor sees first.
    const heroCta = page.getByRole('button', { name: /start free trial/i }).first()
    await expect(heroCta).toBeVisible()
    await expect(heroCta).toBeEnabled()

    await heroCta.click()

    // After clicking the CTA, the app should swap the landing page for the
    // login screen. We assert on stable, role/text-based locators rather
    // than CSS classes so the test survives styling churn.
    await expect(page.getByRole('heading', { name: /welcome to hypnosleep/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
  })

  test('navigation Log In link opens the login page', async ({ page }) => {
    // The nav exposes a "Log In" affordance separately from the trial CTA;
    // it should also reach the login screen rather than be dead UI.
    const loginButtons = page.getByRole('button', { name: /^log in$/i })
    // The desktop nav uses a <button>; we just need at least one to work.
    await loginButtons.first().click()

    await expect(page.getByRole('heading', { name: /welcome to hypnosleep/i })).toBeVisible()
  })

  test('major visible CTA buttons on the landing page are not dead', async ({ page }) => {
    // Dead-UI smoke test: every button labelled "Start Free Trial" that is
    // actually visible on the page must be enabled. A button rendered as a
    // disabled <button> with no handler would fail this assertion.
    const ctas = page.getByRole('button', { name: /start free trial/i })
    // Wait for the lazy-loaded landing page to mount before counting.
    await expect(ctas.first()).toBeVisible()

    const total = await ctas.count()
    expect(total).toBeGreaterThan(0)

    let visibleAndEnabled = 0
    for (let i = 0; i < total; i++) {
      const cta = ctas.nth(i)
      if (await cta.isVisible()) {
        await expect(cta).toBeEnabled()
        visibleAndEnabled++
      }
    }
    expect(visibleAndEnabled).toBeGreaterThan(0)
  })
})
