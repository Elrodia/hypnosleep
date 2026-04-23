import { describe, expect, it } from 'vitest';
import { detectOAuthCredentialIssues } from '@/config/env';
import type { Env } from '@/config/env';

// Minimum viable `Env` fixture — only the fields
// `detectOAuthCredentialIssues` actually inspects are meaningful; the
// rest are populated with plausible placeholders so TypeScript stays
// happy. The helper must never reach into any field it doesn't
// declare a dependency on.
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'production',
    PORT: 3000,
    LOG_LEVEL: 'info',
    FRONTEND_URL: 'https://app.hypnosleep.app',
    API_URL: 'https://app.hypnosleep.app',
    RAILWAY_STATIC_URL: undefined,
    RAILWAY_PUBLIC_DOMAIN: undefined,
    RAILWAY_PUBLIC_URL: undefined,
    STATIC_DIR: undefined,
    DATABASE_URL: 'postgres://test',
    MYSQL_URL: 'mysql://test',
    REDIS_URL: undefined,
    JWT_SECRET: 'jwt-secret-value',
    JWT_EXPIRES_IN: '30d',
    GEMINI_API_KEY: 'gemini-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GOOGLE_CLIENT_ID: '1234567890-abcdef.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'GOCSPX-real-ish-secret',
    GITHUB_CLIENT_ID: 'Ov23liRealish',
    GITHUB_CLIENT_SECRET: 'github_pat_or_similar',
    MICROSOFT_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
    MICROSOFT_CLIENT_SECRET: 'microsoft-secret-value',
    MICROSOFT_TENANT_ID: 'common',
    S3_ACCESS_KEY: 'k',
    S3_SECRET_KEY: 'k',
    S3_BUCKET: 'b',
    S3_ENDPOINT: 'https://r2.example',
    S3_REGION: 'auto',
    S3_FORCE_PATH_STYLE: 'false',
    STRIPE_SECRET_KEY: 'sk_test_xx',
    STRIPE_WEBHOOK_SECRET: 'whsec_xx',
    STRIPE_PRICE_MONTHLY: 'price_xx',
    STRIPE_PRICE_ANNUAL: 'price_xx',
    VITE_STRIPE_PUBLISHABLE_KEY: undefined,
    VITE_STRIPE_MONTHLY_LINK: undefined,
    VITE_STRIPE_ANNUAL_LINK: undefined,
    SENTRY_DSN: undefined,
    POSTHOG_API_KEY: undefined,
    POSTHOG_HOST: undefined,
    ADMIN_USER_IDS: undefined,
    DEBUG_LOG_RETENTION_DAYS: 30,
    DEBUG_LOG_SAMPLE_4XX_RATE: 0,
    DEBUG_LOG_SINK_URL: undefined,
    DEBUG_LOG_SINK_TOKEN: undefined,
    DEBUG_LOG_IP_HASH_PEPPER: undefined,
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    ...overrides,
  };
}

describe('detectOAuthCredentialIssues', () => {
  it('returns no issues for plausible, well-formed credentials', () => {
    expect(detectOAuthCredentialIssues(makeEnv())).toEqual([]);
  });

  it('flags obvious placeholder secrets across all providers', () => {
    const issues = detectOAuthCredentialIssues(
      makeEnv({
        GOOGLE_CLIENT_SECRET: 'changeme',
        GITHUB_CLIENT_SECRET: 'your-github-secret',
        MICROSOFT_CLIENT_SECRET: 'REPLACE_ME',
      }),
    );
    const fields = issues.map((i) => i.field);
    expect(fields).toContain('GOOGLE_CLIENT_SECRET');
    expect(fields).toContain('GITHUB_CLIENT_SECRET');
    expect(fields).toContain('MICROSOFT_CLIENT_SECRET');
  });

  it('flags Google client IDs that do not match the `.apps.googleusercontent.com` format', () => {
    const issues = detectOAuthCredentialIssues(
      makeEnv({ GOOGLE_CLIENT_ID: 'not-a-real-google-client-id' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        provider: 'google',
        field: 'GOOGLE_CLIENT_ID',
        issue: expect.stringContaining('googleusercontent.com'),
      }),
    );
  });

  it('flags placeholder-shaped values wrapped in angle brackets (template syntax)', () => {
    const issues = detectOAuthCredentialIssues(
      makeEnv({ GITHUB_CLIENT_ID: '<your-github-client-id>' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ provider: 'github', field: 'GITHUB_CLIENT_ID' }),
    );
  });

  it('does not return a field value in the issue output (only the env var name)', () => {
    const issues = detectOAuthCredentialIssues(
      makeEnv({ GOOGLE_CLIENT_SECRET: 'changeme-secret-XYZ-sensitive' }),
    );
    for (const issue of issues) {
      expect(JSON.stringify(issue)).not.toContain('XYZ-sensitive');
    }
  });
});
