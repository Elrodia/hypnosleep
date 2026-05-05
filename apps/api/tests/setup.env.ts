/**
 * Vitest global setup: injects test-safe defaults for every required
 * environment variable so modules that eagerly call `loadEnv()` at
 * import time (e.g. `src/config/env.ts`'s `export const env = loadEnv()`)
 * can be loaded by tests without crashing.
 *
 * This file is intentionally side-effect-only and must run before any
 * test file imports `@/config/env`. Real values must never be set here:
 * the goal is to satisfy schema shape, not to authenticate against any
 * real service.
 *
 * Tests that need different values for these variables should mutate
 * `process.env` inside `beforeEach`/`afterEach` and reload modules via
 * `vi.resetModules()`.
 */

const TEST_SAFE_DEFAULTS: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  MYSQL_URL: 'mysql://test:test@localhost:3306/test',
  JWT_SECRET: 'test-jwt-secret-not-real',
  GEMINI_API_KEY: 'test-gemini-key-not-real',
  GOOGLE_CLIENT_ID: '0000000000-test.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-test-secret-not-real',
  GITHUB_CLIENT_ID: 'Iv1.test_not_real',
  GITHUB_CLIENT_SECRET: 'github-test-secret-not-real',
  MICROSOFT_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
  MICROSOFT_CLIENT_SECRET: 'microsoft-test-secret-not-real',
  S3_ACCESS_KEY: 'test-key',
  S3_SECRET_KEY: 'test-secret',
  S3_BUCKET: 'test-bucket',
  S3_ENDPOINT: 'https://s3.test.local',
  S3_REGION: 'auto',
  STRIPE_SECRET_KEY: 'sk_test_not_real',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_not_real',
  STRIPE_PRICE_MONTHLY: 'price_test_monthly',
  STRIPE_PRICE_ANNUAL: 'price_test_annual',
};

for (const [key, value] of Object.entries(TEST_SAFE_DEFAULTS)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}
