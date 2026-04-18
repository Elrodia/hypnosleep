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
   */
  API_URL: z.string().url().default('https://api.hypnosleep.app'),

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
});

export type Env = z.infer<typeof envSchema>;

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
