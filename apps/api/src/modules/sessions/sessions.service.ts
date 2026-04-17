import { logger } from '../../utils/logger.js';
import { notFound } from '../../utils/errors.js';
import type { Session, CreateSessionInput, ListSessionsFilter } from './sessions.types.js';

/**
 * In-memory session store (placeholder).
 * In production this will be backed by MySQL via Drizzle ORM.
 */
const sessionStore = new Map<string, Session>();

/**
 * Creates a new session record.
 */
export async function createSession(input: CreateSessionInput): Promise<Session> {
  const session: Session = {
    ...input,
    scriptText: null,
    audioUrl: null,
    playCount: 0,
    isTemplate: false,
    createdAt: new Date(),
  };

  sessionStore.set(session.id, session);

  logger.info(
    { sessionId: session.id, userId: session.userId },
    'Session record created',
  );

  return session;
}

/**
 * Retrieves a session by ID.
 * Throws NOT_FOUND if the session doesn't exist.
 */
export async function getSessionById(sessionId: string): Promise<Session> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    throw notFound('Session');
  }
  return session;
}

/**
 * Lists sessions with optional filtering and pagination.
 */
export async function listSessions(
  filter: ListSessionsFilter,
): Promise<{ sessions: Session[]; total: number }> {
  let results = Array.from(sessionStore.values()).filter(
    (s) => s.userId === filter.userId,
  );

  if (filter.category) {
    results = results.filter((s) => s.category === filter.category);
  }

  if (filter.status) {
    results = results.filter((s) => s.status === filter.status);
  }

  if (filter.isTemplate !== undefined) {
    results = results.filter((s) => s.isTemplate === filter.isTemplate);
  }

  const total = results.length;
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const offset = (page - 1) * limit;
  const paged = results.slice(offset, offset + limit);

  return { sessions: paged, total };
}

/**
 * Updates a session's status, audio URL, and/or script text.
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<Session, 'status' | 'audioUrl' | 'scriptText' | 'durationSec'>>,
): Promise<Session> {
  const session = sessionStore.get(sessionId);
  if (!session) {
    throw notFound('Session');
  }

  Object.assign(session, updates);
  sessionStore.set(sessionId, session);

  logger.info(
    { sessionId, updates: Object.keys(updates) },
    'Session updated',
  );

  return session;
}

/**
 * Deletes a session.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionStore.has(sessionId)) {
    throw notFound('Session');
  }
  sessionStore.delete(sessionId);
  logger.info({ sessionId }, 'Session deleted');
}

/**
 * Clears the in-memory store (for testing).
 */
export function _clearSessionStore(): void {
  sessionStore.clear();
}
