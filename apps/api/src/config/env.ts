import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3000'),

  MYSQL_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().default('hypnosleep-audio'),
  R2_PUBLIC_URL: z.string().url(),

  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().default('common'),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_MONTHLY: z.string().min(1),
  STRIPE_PRICE_YEARLY: z.string().min(1),

  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email().default('hello@hypnosleep.app'),

  POSTHOG_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates and returns environment variables.
 * Fails fast if required variables are missing.
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

export const env = loadEnv();
