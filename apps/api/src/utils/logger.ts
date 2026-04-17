import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

/**
 * Structured JSON logger (Pino).
 * Redacts sensitive fields from log output.
 */
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
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  serializers: {
    email: () => '[REDACTED]',
  },
});
