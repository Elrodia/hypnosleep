/**
 * Cross-component flag for "user wants to see the Pro upgrade page".
 *
 * Set by PaywallModal's primary CTA before navigating to the Profile
 * tab. Read once by ProfilePage on mount; ProfilePage clears it
 * immediately so a refresh of the Profile tab doesn't keep popping
 * the upgrade page.
 *
 * Intentionally module-level (not React state, not localStorage):
 * the intent is transient — it must survive a tab switch but not a
 * page reload.
 */
let pendingUpgrade = false

export function requestUpgradePage(): void {
  pendingUpgrade = true
}

/** Read-and-clear. Returns true at most once per request. */
export function consumeUpgradeRequest(): boolean {
  if (pendingUpgrade) {
    pendingUpgrade = false
    return true
  }
  return false
}
