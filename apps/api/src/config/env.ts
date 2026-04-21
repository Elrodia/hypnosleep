import { z } from 'zod';
import { AppError } from '../utils/errors.js';

/** Coerces empty strings to `undefined` so `.optional()` works with unset env vars. */
const optionalString = () =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(1).optional(),
  );

/**
 * Runtime environment variables for the HypnoSleep API.
 *
 * Validated on demand via `loadEnv()` so the process fails fast if any
 * required variable is missing or malformed. The server entrypoint calls
 * `loadEnv()` (indirectly, via importing `env`) at startup; consumers that
 * don't need env (e.g. unit tests) can avoid importing this module.
 */
const envSchema = z.object({
  // --- Runtime -------------------------------------------------------------
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('production'),
  PORT: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.coerce.number().int().positive().default(3000),
    ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  FRONTEND_URL: z.string().url().default('https://app.hypnosleep.app'),
  /**
   * Public base URL of the API, used to build OAuth callback URLs
   * (e.g. `${API_URL}/api/auth/google/callback`). Must match what is
   * registered with each OAuth provider.
   *
   * Defaults to the same origin as `FRONTEND_URL` because the Railway
   * deployment serves the API and the SPA behind a single domain
   * (`https://app.hypnosleep.app`). Override in environments where the
   * API is hosted on a different origin.
   */
  API_URL: z.string().url().default('https://app.hypnosleep.app'),
  /** Railway-provided public URL (if running on Railway). */
  RAILWAY_STATIC_URL: optionalString(),
  /** Railway-provided public domain, without protocol (if running on Railway). */
  RAILWAY_PUBLIC_DOMAIN: optionalString(),
  /** Optional Railway public URL override when provided by platform/runtime. */
  RAILWAY_PUBLIC_URL: optionalString(),

  /**
   * Absolute path to the built Vite SPA that the API should serve as
   * static assets (with SPA fallback). When unset, the API only serves
   * `/api/*` routes — useful for local backend-only development.
   */
  STATIC_DIR: optionalString(),

  // --- Databases -----------------------------------------------------------
  DATABASE_URL: z.string().min(1),
  MYSQL_URL: z.string().min(1),
  // Redis is optional: rate-limiting and the audio worker degrade gracefully
  // when it is not configured.
  REDIS_URL: optionalString(),

  // --- Auth ----------------------------------------------------------------
  JWT_SECRET: z.string().min(1),
  /** jsonwebtoken `expiresIn` string (e.g. `30d`, `12h`). */
  JWT_EXPIRES_IN: z.string().min(1).default('30d'),

  // --- AI ------------------------------------------------------------------
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),

  // --- OAuth providers -----------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  /**
   * Microsoft Entra (Azure AD) tenant. Use `common` to allow both
   * personal Microsoft accounts and any work/school account.
   */
  MICROSOFT_TENANT_ID: z.string().min(1).default('common'),

  // --- Object storage (S3-compatible, e.g. Cloudflare R2) ------------------
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  // Consumed at runtime as `process.env.S3_FORCE_PATH_STYLE === 'true'`
  // (see `r2.service.ts`), so validate it as an explicit boolean-ish
  // enum with a safe default instead of a required opaque string.
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),

  // --- Billing (Stripe) ----------------------------------------------------
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_MONTHLY: z.string().min(1),
  STRIPE_PRICE_ANNUAL: z.string().min(1),

  // --- Client-visible Stripe config (Vite, injected at build time) ---------
  // These are frontend build-time variables and are not consumed by the
  // API at runtime. Keep them in the schema for documentation but make
  // them optional so the API doesn't refuse to boot in environments
  // that don't set Vite client vars.
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  VITE_STRIPE_MONTHLY_LINK: z.string().min(1).optional(),
  VITE_STRIPE_ANNUAL_LINK: z.string().min(1).optional(),

  // --- Monitoring ----------------------------------------------------------
  /** Sentry DSN for server-side error reporting. When unset, Sentry is disabled. */
  SENTRY_DSN: optionalString(),
  /** PostHog project API key for server-side analytics. When unset, analytics are no-ops. */
  POSTHOG_API_KEY: optionalString(),
  /** Optional PostHog host override (defaults to the PostHog Cloud endpoint). */
  POSTHOG_HOST: optionalString(),

  // --- Email (Resend) ------------------------------------------------------
  /**
   * Resend API key for transactional email delivery.
   * When unset, emails are only logged (log transport — suitable for development).
   */
  RESEND_API_KEY: optionalString(),
  /**
   * "From" address used in all outbound emails.
   * Defaults to `HypnoSleep <noreply@hypnosleep.app>` when unset.
   */
  EMAIL_FROM: optionalString(),
});

export type Env = z.infer<typeof envSchema>;


export const OAUTH_PROVIDERS = ['google', 'github', 'microsoft'] as const;

export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

export function buildOAuthCallbackUrls(apiUrl: string): Record<OAuthProviderName, string> {
  // Build URLs against the parsed origin so a trailing slash or accidental
  // path segment on `API_URL` can't produce double slashes or duplicated
  // path prefixes in the registered OAuth callback URLs.
  const origin = new URL(apiUrl).origin;
  return {
    google: new URL('/api/auth/google/callback', origin).toString(),
    github: new URL('/api/auth/github/callback', origin).toString(),
    microsoft: new URL('/api/auth/microsoft/callback', origin).toString(),
  };
}

export function isSecureAuthCookie(nodeEnv: Env['NODE_ENV']): boolean {
  return nodeEnv === 'production';
}

function parseUrlOrThrow(name: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new AppError('INVALID_ENV', `${name} must be a valid absolute URL`, 500, {
      fieldErrors: { [name]: ['Invalid URL format'] },
    });
  }
}

function normalizeRailwayDomain(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    if (value.includes('://')) {
      return new URL(value).hostname.toLowerCase();
    }
    return value.toLowerCase();
  } catch {
    return null;
  }
}

export interface AuthRuntimeDiagnostics {
  callbackUrls: Record<OAuthProviderName, string>;
  secureCookie: boolean;
  nodeEnv: Env['NODE_ENV'];
  frontendOrigin: string;
  apiOrigin: string;
  railwayDomain: string | null;
  railwayApiDomainMismatch: boolean;
}

/**
 * Validates public auth-facing URLs and computes non-secret diagnostics.
 */
export function validateAuthRuntimeConfig(currentEnv: Env): AuthRuntimeDiagnostics {
  const frontend = parseUrlOrThrow('FRONTEND_URL', currentEnv.FRONTEND_URL);
  const api = parseUrlOrThrow('API_URL', currentEnv.API_URL);

  if (currentEnv.NODE_ENV === 'production') {
    if (frontend.protocol !== 'https:') {
      throw new AppError('INVALID_ENV', 'FRONTEND_URL must use HTTPS in production', 500, {
        fieldErrors: { FRONTEND_URL: ['Must start with https:// in production'] },
      });
    }
    if (api.protocol !== 'https:') {
      throw new AppError('INVALID_ENV', 'API_URL must use HTTPS in production', 500, {
        fieldErrors: { API_URL: ['Must start with https:// in production'] },
      });
    }
  }

  // `API_URL` is used to derive OAuth callback URLs by appending
  // `/api/auth/...`, so it must represent a pure public origin. Anything
  // beyond `/` in the pathname or any search/hash component would silently
  // produce invalid callback URLs registered with OAuth providers.
  if (api.pathname !== '' && api.pathname !== '/') {
    throw new AppError(
      'INVALID_ENV',
      'API_URL must not include a path — it must be a bare origin',
      500,
      {
        fieldErrors: { API_URL: [`Unexpected pathname "${api.pathname}"`] },
      },
    );
  }
  if (api.search !== '') {
    throw new AppError(
      'INVALID_ENV',
      'API_URL must not include a query string',
      500,
      {
        fieldErrors: { API_URL: [`Unexpected query "${api.search}"`] },
      },
    );
  }
  if (api.hash !== '') {
    throw new AppError(
      'INVALID_ENV',
      'API_URL must not include a hash fragment',
      500,
      {
        fieldErrors: { API_URL: [`Unexpected hash "${api.hash}"`] },
      },
    );
  }

  const railwayDomain =
    normalizeRailwayDomain(currentEnv.RAILWAY_PUBLIC_DOMAIN ?? '') ??
    normalizeRailwayDomain(currentEnv.RAILWAY_PUBLIC_URL ?? '') ??
    normalizeRailwayDomain(currentEnv.RAILWAY_STATIC_URL ?? '');

  const apiDomain = api.hostname.toLowerCase();
  const railwayApiDomainMismatch =
    Boolean(railwayDomain) && railwayDomain !== apiDomain;

  return {
    callbackUrls: buildOAuthCallbackUrls(api.origin),
    secureCookie: isSecureAuthCookie(currentEnv.NODE_ENV),
    nodeEnv: currentEnv.NODE_ENV,
    frontendOrigin: frontend.origin,
    apiOrigin: api.origin,
    railwayDomain,
    railwayApiDomainMismatch,
  };
}

/**
 * Parses and validates `process.env`. Throws a typed {@link AppError} if
 * validation fails so callers (server entrypoint, tooling) can decide how
 * to handle misconfiguration rather than having the module forcibly exit
 * the process on import.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    throw new AppError(
      'INVALID_ENV',
      'Invalid environment variables',
      500,
      { fieldErrors },
    );
  }
  return result.data;
}

export const env: Env = loadEnv();
