import pino from 'pino';

/**
 * Structured JSON logger (Pino).
 *
 * Reads `LOG_LEVEL` / `NODE_ENV` directly from `process.env` with safe
 * fallbacks so this module can be imported from contexts (tests, CLI tools)
 * that have not loaded the full validated env. The main server entrypoint
 * validates both variables via `config/env.ts` at startup, so when running
 * in production the same values are applied here.
 *
 * Redacts sensitive fields from log output.
 */
const level = process.env.LOG_LEVEL ?? 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.stripeCustomerId',
    ],
    censor: '[REDACTED]',
  },
  transport: isDevelopment
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
  serializers: {
    email: () => '[REDACTED]',
  },
});
