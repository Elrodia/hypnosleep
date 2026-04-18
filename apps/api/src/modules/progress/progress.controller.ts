import type { Request, Response, NextFunction } from 'express';
import {
  moodLogSchema,
  heatmapQuerySchema,
  moodTrendQuerySchema,
} from './progress.schema.js';
import {
  logMood,
  getStats,
  getStreak,
  getHeatmap,
  getMoodTrend,
  getWeeklyInsight,
} from './progress.service.js';
import { validationFailed } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * Extracts the authenticated user id set by `authenticate()`. Every
 * route in this controller is protected by that middleware, so a
 * missing `req.user` is a server-side invariant failure rather than
 * a client error.
 */
function requireUserId(req: Request): string {
  const user = req.user as JwtPayload | undefined;
  if (!user?.userId) {
    throw new Error('Authenticated user id missing');
  }
  return user.userId;
}

/**
 * Narrow Zod wrapper that unwraps a successful parse or throws a
 * `VALIDATION_FAILED` AppError with flattened field errors, matching
 * the envelope used by the rest of the API.
 */
function parseOrThrow<T>(
  schema: {
    safeParse: (
      input: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { flatten: () => unknown } };
  },
  input: unknown,
  message: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flat = result.error.flatten() as {
      fieldErrors?: Record<string, unknown>;
    };
    throw validationFailed(message, { errors: flat.fieldErrors ?? flat });
  }
  return result.data;
}

/** POST /api/progress/mood-log */
export async function handleLogMood(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = parseOrThrow(moodLogSchema, req.body, 'Invalid mood log');
    const data = await logMood(requireUserId(req), input);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/stats */
export async function handleStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ data: await getStats(requireUserId(req)) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/streak */
export async function handleStreak(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ data: await getStreak(requireUserId(req)) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/heatmap */
export async function handleHeatmap(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { days } = parseOrThrow(
      heatmapQuerySchema,
      req.query,
      'Invalid heatmap query',
    );
    res.json({ data: await getHeatmap(requireUserId(req), days) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/mood-trend */
export async function handleMoodTrend(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { days } = parseOrThrow(
      moodTrendQuerySchema,
      req.query,
      'Invalid mood trend query',
    );
    res.json({ data: await getMoodTrend(requireUserId(req), days) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/progress/weekly-insight */
export async function handleWeeklyInsight(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.json({ data: await getWeeklyInsight(requireUserId(req)) });
  } catch (err) {
    next(err);
  }
}
