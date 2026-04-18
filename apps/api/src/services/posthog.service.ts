import { PostHog } from 'posthog-node';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Server-side PostHog client. When `POSTHOG_API_KEY` is unset the
 * client is `null` and all helpers below become no-ops, so callers
 * don't need to check the flag themselves.
 */
export const posthog: PostHog | null = env.POSTHOG_API_KEY
  ? new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST ?? 'https://app.posthog.com',
    })
  : null;

/**
 * Capture a product analytics event. Safe to call whether or not
 * PostHog is configured.
 */
export function track(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (!posthog) return;
  try {
    posthog.capture({ distinctId: userId, event, properties });
  } catch (err) {
    logger.warn({ err, event }, 'Failed to capture PostHog event');
  }
}

/**
 * Flush pending events and shut down the background queue. Call
 * during graceful shutdown so in-flight events aren't dropped.
 */
export async function shutdownPostHog(): Promise<void> {
  if (!posthog) return;
  try {
    await posthog.shutdown();
  } catch (err) {
    logger.warn({ err }, 'Failed to shut down PostHog cleanly');
  }
}
