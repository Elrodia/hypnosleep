import type { Request, Response, NextFunction } from 'express';
import {
  getSessionById,
  listSessions,
  deleteSession,
} from './sessions.service.js';
import { listSessionsSchema, sessionIdSchema } from './sessions.schema.js';
import { validationFailed, forbidden } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * GET /api/sessions
 * Lists the authenticated user's sessions.
 */
export async function handleListSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const query = listSessionsSchema.safeParse(req.query);

    if (!query.success) {
      throw validationFailed('Invalid query parameters', {
        errors: query.error.flatten().fieldErrors,
      });
    }

    const { page, limit, ...filters } = query.data;

    const result = await listSessions({
      userId: user.userId,
      page,
      limit,
      ...filters,
    });

    res.json({
      data: result.sessions,
      meta: {
        total: result.total,
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/sessions/:id
 * Gets a specific session by ID.
 */
export async function handleGetSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const params = sessionIdSchema.safeParse(req.params);

    if (!params.success) {
      throw validationFailed('Invalid session ID');
    }

    const session = await getSessionById(params.data.id);

    // Users can only access their own sessions (or templates)
    if (session.userId !== user.userId && !session.isTemplate) {
      throw forbidden('You can only access your own sessions');
    }

    res.json({ data: session });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/sessions/:id
 * Deletes a specific session.
 */
export async function handleDeleteSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const params = sessionIdSchema.safeParse(req.params);

    if (!params.success) {
      throw validationFailed('Invalid session ID');
    }

    // Verify ownership before deleting
    const session = await getSessionById(params.data.id);
    if (session.userId !== user.userId) {
      throw forbidden('You can only delete your own sessions');
    }

    await deleteSession(params.data.id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
