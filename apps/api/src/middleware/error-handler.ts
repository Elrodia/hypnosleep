import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, logger } from '../utils/index.js';
import {
  classifyHttpCategory,
  recordDebugEvent,
  shouldSample4xx,
} from '../services/debug-log.service.js';

/**
 * 404 handler for unmatched routes. Registered before the generic
 * {@link errorHandler} so requests that don't match any route still
 * receive a structured JSON error instead of Express' default HTML.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

/**
 * Captures a response outcome into `debug_events` when appropriate.
 * 5xx is always persisted; 4xx respects the configured sampling rate.
 * Never throws — logging must not crash the error path.
 */
function captureErrorEvent(
  err: Error,
  req: Request,
  status: number,
  code: string,
): void {
  if (status < 400) return;
  if (status < 500 && !shouldSample4xx()) return;
  void recordDebugEvent({
    rid: req.rid,
    level: status >= 500 ? 'error' : 'warn',
    category: classifyHttpCategory(status),
    reason: code,
    message:
      status >= 500
        ? `Unhandled error on ${req.method} ${req.path}`
        : `Client error ${status} on ${req.method} ${req.path}`,
    userId: req.userId ?? null,
    context: {
      // `AppError.details` may contain field-level validation hints —
      // useful for diagnosis and safe because the redactor drops any
      // sensitive keys defensively.
      details:
        err instanceof AppError && err.details ? err.details : undefined,
    },
    error: err,
    httpStatus: status,
    method: req.method,
    path: req.path || req.originalUrl || '',
    userAgent:
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    ip: req.ip ?? null,
  });
}

/**
 * Global Express error handler.
 * Catches AppError instances and unhandled errors,
 * returning structured JSON error responses.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    captureErrorEvent(err, req, 400, 'VALIDATION_FAILED');
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid request data',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    captureErrorEvent(err, req, err.statusCode, err.code);
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  logger.error({ err, stack: err.stack, path: req.path, rid: req.rid }, 'Unhandled error');
  captureErrorEvent(err, req, 500, 'INTERNAL_SERVER_ERROR');

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
  });
}
