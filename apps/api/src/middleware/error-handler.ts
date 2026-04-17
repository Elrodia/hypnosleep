import type { Request, Response, NextFunction } from 'express';
import { AppError, logger } from '../utils/index.js';

/**
 * Global Express error handler.
 * Catches AppError instances and unhandled errors,
 * returning structured JSON error responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.toJSON());
    return;
  }

  logger.error({ err, stack: err.stack }, 'Unhandled error');

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
