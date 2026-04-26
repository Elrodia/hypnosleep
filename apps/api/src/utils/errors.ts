/**
 * Application error class with structured error codes and HTTP status codes.
 * Used for all expected/handled errors thrown throughout the API.
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

/** 401 — Missing or invalid authentication */
export function unauthenticated(message = 'Authentication required') {
  return new AppError('UNAUTHENTICATED', message, 401);
}

/** 403 — Authenticated but insufficient permissions */
export function forbidden(message = 'Access denied') {
  return new AppError('FORBIDDEN', message, 403);
}

/** 404 — Resource not found */
export function notFound(resource = 'Resource') {
  return new AppError('NOT_FOUND', `${resource} not found`, 404);
}

/** 400 — Input validation failure */
export function validationFailed(message: string, details?: Record<string, unknown>) {
  return new AppError('VALIDATION_FAILED', message, 400, details);
}

/** 429 — Rate limit exceeded */
export function rateLimitExceeded(message: string, details?: Record<string, unknown>) {
  return new AppError('RATE_LIMIT_EXCEEDED', message, 429, details);
}

/**
 * 429 — Upstream provider quota exhausted (e.g. Gemini free-tier
 * daily request cap). Distinct from {@link rateLimitExceeded} (which
 * covers our own per-user limiter): a `QUOTA_EXHAUSTED` error means
 * retrying within the same window is futile and callers should bail
 * out rather than burn backoff on doomed attempts.
 */
export function quotaExhausted(
  service: string,
  message?: string,
  details?: Record<string, unknown>,
) {
  return new AppError(
    'QUOTA_EXHAUSTED',
    message ?? `Quota exhausted for "${service}"`,
    429,
    { service, ...(details ?? {}) },
  );
}

/** 402 — Feature requires Pro subscription */
export function proRequired(message = 'This feature requires a Pro subscription') {
  return new AppError('PRO_REQUIRED', message, 402);
}

/** 500 — AI generation failed */
export function generationFailed(message = 'Session generation failed', details?: Record<string, unknown>) {
  return new AppError('GENERATION_FAILED', message, 500, details);
}

/** 502 — External API (Gemini, TTS, etc.) failure */
export function externalApiError(service: string, message?: string) {
  return new AppError(
    'EXTERNAL_API_ERROR',
    message ?? `External service "${service}" returned an error`,
    502,
    { service },
  );
}
