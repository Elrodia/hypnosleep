import { z } from 'zod';

/**
 * Runtime environment variables for the HypnoSleep API.
 *
 * Validated at module load with Zod so the process fails fast if any
 * required variable is missing or malformed.
 */
const envSchema = z.object({
  // --- Databases -----------------------------------------------------------
  DATABASE_URL: z.string().min(1),
  MYSQL_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // --- AI ------------------------------------------------------------------
  GEMINI_API_KEY: z.string().min(1),

  // --- OAuth providers -----------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),

  // --- Object storage (S3-compatible, e.g. Cloudflare R2) ------------------
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.string().min(1),

  // --- Billing (Stripe) ----------------------------------------------------
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_MONTHLY: z.string().min(1),
  STRIPE_PRICE_ANNUAL: z.string().min(1),

  // --- Client-visible Stripe config (Vite, injected at build time) ---------
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_STRIPE_MONTHLY_LINK: z.string().min(1),
  VITE_STRIPE_ANNUAL_LINK: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`. Exits the process with a formatted
 * error report if validation fails — this keeps misconfigurations from
 * silently propagating into services at runtime.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error('❌ Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env: Env = loadEnv();
