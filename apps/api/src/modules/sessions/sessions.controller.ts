import type { Request, Response, NextFunction } from 'express';
import {
  generateSessionSchema,
  listSessionsQuerySchema,
  editScriptSchema,
  regenerateSchema,
  sessionIdSchema,
} from './sessions.schema.js';
import {
  createGenerationSession,
  listSessions,
  getSessionById,
  getAudioUrl,
  deleteSession,
  toggleFavorite,
  recordPlay,
  editScript,
  regenerateAudio,
  getTrending,
} from './sessions.service.js';
import { validationFailed } from '../../utils/errors.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/**
 * Centralised Zod-result unwrap. Surfaces field-level errors via the
 * standard `VALIDATION_FAILED` error envelope so the global error
 * middleware can render them.
 */
function parseOrThrow<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } },
  input: unknown,
  message: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const flat = result.error.flatten() as { fieldErrors?: Record<string, unknown> };
    throw validationFailed(message, { errors: flat.fieldErrors ?? flat });
  }
  return result.data;
}

/** POST /api/sessions/generate */
export async function handleGenerate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const input = parseOrThrow(
      generateSessionSchema,
      req.body,
      'Invalid session generation parameters',
    );
    const result = await createGenerationSession(user.userId, input);
    res.status(202).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sessions */
export async function handleList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const query = parseOrThrow(
      listSessionsQuerySchema,
      req.query,
      'Invalid query parameters',
    );
    const result = await listSessions(user.userId, query);
    res.json({ data: result.items, meta: result.meta });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sessions/:id */
export async function handleGetOne(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const data = await getSessionById(user.userId, id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sessions/:id/audio */
export async function handleGetAudio(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const result = await getAudioUrl(user.userId, id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/sessions/:id */
export async function handleDelete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    await deleteSession(user.userId, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/** POST /api/sessions/:id/favorite */
export async function handleFavorite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const favorited = await toggleFavorite(user.userId, id);
    res.json({ data: { favorited } });
  } catch (err) {
    next(err);
  }
}

/** POST /api/sessions/:id/play */
export async function handlePlay(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const result = await recordPlay(user.userId, id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/sessions/:id/script (Pro only) */
export async function handleEditScript(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const body = parseOrThrow(editScriptSchema, req.body, 'Invalid script body');
    const result = await editScript(user.userId, id, body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/sessions/:id/regenerate */
export async function handleRegenerate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user as JwtPayload;
    const { id } = parseOrThrow(sessionIdSchema, req.params, 'Invalid session ID');
    const body = parseOrThrow(
      regenerateSchema,
      req.body ?? {},
      'Invalid regenerate body',
    );
    const result = await regenerateAudio(
      user.userId,
      id,
      body,
      user.plan === 'pro',
    );
    res.status(202).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/sessions/trending */
export async function handleTrending(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getTrending();
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Back-compat aliases. Older imports referenced `handleListSessions`,
// `handleGetSession`, and `handleDeleteSession`; keep the names valid
// so we don't break callers outside this module.
// ─────────────────────────────────────────────────────────────────────
export {
  handleList as handleListSessions,
  handleGetOne as handleGetSession,
  handleDelete as handleDeleteSession,
};
