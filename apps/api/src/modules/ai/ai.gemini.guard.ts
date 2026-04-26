import { checkRateLimit } from '../../db/redis/helpers.js';
import { rateLimitExceeded } from '../../utils/errors.js';

/**
 * Gemini provider-level quota guard.
 *
 * Enforces per-minute and per-day call limits immediately before each
 * external Gemini request so the application stays within the upstream
 * provider quotas (Gemini 2.5 Flash-Lite defaults: 15 req/min, 1 000
 * req/day).
 *
 * Limit values are configurable via environment variables:
 *   GEMINI_RATE_LIMIT_PER_MINUTE  (default: 15)
 *   GEMINI_RATE_LIMIT_PER_DAY     (default: 1000)
 *
 * Redis availability:
 *   When Redis is not configured (REDIS_URL unset), the underlying
 *   `checkRateLimit` helper allows the call through — this matches the
 *   project-wide graceful-degradation convention (see
 *   `db/redis/helpers.ts` and `middleware/rate-limit.ts`) and keeps
 *   local development and tests working without a Redis instance.
 *   In production, Redis is always present via the Railway plugin.
 *
 *   If Redis IS configured but a command fails at runtime, the error
 *   propagates as an unexpected exception to the caller.
 *
 * Retry-After:
 *   Rejection errors carry `retryAfter` (seconds) derived from the
 *   oldest timestamp still inside the sliding window, giving callers
 *   accurate backoff information for a `Retry-After` response header.
 */

const MINUTE_WINDOW_SEC = 60;
const DAY_WINDOW_SEC = 86_400;

/**
 * Reads the per-minute Gemini quota limit from `GEMINI_RATE_LIMIT_PER_MINUTE`.
 * Falls back to 15 (Flash-Lite default) when the variable is absent or invalid.
 */
function getMinuteLimit(): number {
  const v = Number(process.env.GEMINI_RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(v) && v > 0 ? v : 15;
}

/**
 * Reads the per-day Gemini quota limit from `GEMINI_RATE_LIMIT_PER_DAY`.
 * Falls back to 1000 (Flash-Lite default) when the variable is absent or invalid.
 */
function getDayLimit(): number {
  const v = Number(process.env.GEMINI_RATE_LIMIT_PER_DAY);
  return Number.isFinite(v) && v > 0 ? v : 1000;
}

/**
 * Checks both the per-minute and per-day Gemini quota windows.
 *
 * Throws a typed 429 `AppError` (`RATE_LIMIT_EXCEEDED`) if either limit
 * is exceeded, carrying `limit`, `windowSec`, and `retryAfter` (seconds)
 * in the error details so callers can surface an accurate `Retry-After`
 * header.
 *
 * Call this immediately before every external Gemini request (i.e. inside
 * `callGemini` in `ai.gemini.ts`).
 */
export async function checkGeminiQuota(): Promise<void> {
  // Per-minute window check.
  const minuteLimit = getMinuteLimit();
  const minuteResult = await checkRateLimit(
    'gemini:minute',
    minuteLimit,
    MINUTE_WINDOW_SEC,
  );
  if (!minuteResult.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((minuteResult.resetAt - Date.now()) / 1000),
    );
    throw rateLimitExceeded(
      `Gemini per-minute quota exceeded (limit: ${minuteLimit}/min). Retry after ${retryAfter}s.`,
      { limit: minuteLimit, windowSec: MINUTE_WINDOW_SEC, retryAfter },
    );
  }

  // Per-day window check.
  const dayLimit = getDayLimit();
  const dayResult = await checkRateLimit(
    'gemini:day',
    dayLimit,
    DAY_WINDOW_SEC,
  );
  if (!dayResult.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((dayResult.resetAt - Date.now()) / 1000),
    );
    throw rateLimitExceeded(
      `Gemini daily quota exceeded (limit: ${dayLimit}/day). Retry after ${retryAfter}s.`,
      { limit: dayLimit, windowSec: DAY_WINDOW_SEC, retryAfter },
    );
  }
}
