/**
 * PostHog stub.
 *
 * The real landing page is expected to load PostHog lazily (after the first
 * user interaction) to protect LCP. Until the real key is wired up we ship a
 * no-op so that analytics calls are safe to make anywhere in the tree.
 */
type EventProps = Record<string, unknown>

interface PosthogLike {
  capture: (event: string, props?: EventProps) => void
}

const noop: PosthogLike = {
  capture: (event, props) => {
    if (typeof window === 'undefined') return
    // Surface analytics in the console during development only.
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[posthog]', event, props ?? {})
    }
  },
}

export const posthog: PosthogLike = noop
