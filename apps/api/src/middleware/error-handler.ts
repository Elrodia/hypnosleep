import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, logger } from '../utils/index.js';

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
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  logger.error({ err, stack: err.stack, path: req.path }, 'Unhandled error');

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
