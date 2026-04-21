import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { isValidRequestId } from '../../middleware/request-id.js';
import {
  getDebugEventsByRid,
  getDebugLogHealth,
  listDebugEvents,
  pruneOldDebugEvents,
  type DebugEventCategory,
} from '../../services/debug-log.service.js';
import { env } from '../../config/env.js';
import { notFound, validationFailed } from '../../utils/errors.js';

export const adminDebugRouter = Router();

/**
 * Admin debug endpoints are intentionally registered under
 * `/api/admin/*` (not nested inside any module router) so that the
 * admin gate (`requireAuth` → `requireAdmin`) is applied uniformly
 * and can't be accidentally skipped by a misplaced `.use()`.
 */
adminDebugRouter.use(requireAuth);
adminDebugRouter.use(requireAdmin);

const CATEGORIES: readonly DebugEventCategory[] = [
  'oauth',
  'subscription',
  'ai',
  'http_4xx',
  'http_5xx',
  'worker',
  'other',
];

const listQuerySchema = z.object({
  category: z
    .string()
    .optional()
    .refine((v) => v === undefined || (CATEGORIES as readonly string[]).includes(v), {
      message: 'Unknown category',
    }),
  userId: z.string().trim().min(1).max(36).optional(),
  since: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().datetime().optional()),
  until: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().datetime().optional()),
  limit: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().int().min(1).max(200).optional()),
});

async function handleList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(validationFailed('Invalid query parameters', parsed.error.flatten().fieldErrors));
      return;
    }
    const { category, userId, since, until, limit } = parsed.data;
    const events = await listDebugEvents({
      category: category as DebugEventCategory | undefined,
      userId,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      limit,
    });
    res.json({ data: { events, count: events.length } });
  } catch (err) {
    next(err);
  }
}

adminDebugRouter.get('/events', handleList);

/**
 * JSONL export — one event per line. Used by on-call engineers who
 * want to pipe a filtered slice into `jq` or a downstream tool.
 */
adminDebugRouter.get('/events.jsonl', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(validationFailed('Invalid query parameters', parsed.error.flatten().fieldErrors));
      return;
    }
    const { category, userId, since, until, limit } = parsed.data;
    const events = await listDebugEvents({
      category: category as DebugEventCategory | undefined,
      userId,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      limit: limit ?? 200,
    });
    res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    res.setHeader(
      'content-disposition',
      `attachment; filename="debug-events-${new Date().toISOString()}.jsonl"`,
    );
    for (const e of events) {
      res.write(`${JSON.stringify(e)}\n`);
    }
    res.end();
  } catch (err) {
    next(err);
  }
});

adminDebugRouter.get('/events/:rid', async (req, res, next) => {
  try {
    const rid = req.params.rid;
    if (!isValidRequestId(rid)) {
      next(validationFailed('rid must be a UUIDv4', { rid: ['Invalid format'] }));
      return;
    }
    const events = await getDebugEventsByRid(rid);
    if (events.length === 0) {
      next(notFound('Debug events'));
      return;
    }
    res.json({ data: { rid, events, count: events.length } });
  } catch (err) {
    next(err);
  }
});

/**
 * Operator trigger: force an immediate prune outside of the hourly
 * schedule. Useful for running retention after a policy change.
 */
adminDebugRouter.post('/prune', async (_req, res, next) => {
  try {
    const deleted = await pruneOldDebugEvents(env.DEBUG_LOG_RETENTION_DAYS);
    res.json({ data: { deleted, retentionDays: env.DEBUG_LOG_RETENTION_DAYS } });
  } catch (err) {
    next(err);
  }
});

adminDebugRouter.get('/health', (_req, res) => {
  res.json({
    data: {
      ...getDebugLogHealth(),
      retentionDays: env.DEBUG_LOG_RETENTION_DAYS,
      sample4xxRate: env.DEBUG_LOG_SAMPLE_4XX_RATE,
      sinkConfigured: Boolean(env.DEBUG_LOG_SINK_URL),
    },
  });
});
