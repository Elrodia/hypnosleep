import type { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { mysqlDb } from '../../db/mysql/client.js';
import { sessions } from '../../db/mysql/schema/sessions.js';
import { generationBus, type ProgressEvent } from '../../queues/events.bus.js';
import { logger } from '../../utils/logger.js';
import type { JwtPayload } from '../../middleware/authenticate.js';

/** Hard cap on a single SSE connection (5 minutes). */
const SSE_TIMEOUT_MS = 5 * 60_000;
/** Keepalive comment cadence to defeat idle-proxy timeouts. */
const SSE_KEEPALIVE_MS = 15_000;

/**
 * GET /api/sessions/:id/events
 *
 * Server-Sent Events stream that pushes generation progress updates
 * for a single session in real time. The handler is deliberately
 * thin: heavy lifting (script generation, TTS, mixing, upload) lives
 * in the BullMQ worker, which emits {@link ProgressEvent}s onto the
 * in-process {@link generationBus}; we just forward them here.
 *
 * **Why SSE and not WebSockets?** Generation progress is one-way and
 * short-lived (30–60s). SSE is a single GET that traverses every
 * proxy without upgrade negotiation and reconnects automatically in
 * the browser via `EventSource`. The trade-off is that
 * `EventSource` cannot set `Authorization` headers — we accept
 * `?token=` via {@link authenticateFromQuery} for this route only.
 *
 * **Lifecycle / cleanup:**
 *   - Subscribes to `generationBus` for the session.
 *   - Sends a `: ping\n\n` comment every {@link SSE_KEEPALIVE_MS}ms.
 *   - Hard-closes after {@link SSE_TIMEOUT_MS}ms regardless of state
 *     so a stuck job can never hold a connection forever.
 *   - Cleans up bus subscription, keepalive interval, and timeout on
 *     `req.close` (client disconnect) and on terminal events
 *     (`done`/`error`).
 *
 * Authorization: the caller MUST be the owner of the session. We
 * verify ownership against MySQL before attaching any listeners.
 */
export async function sessionEventsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.params.id;
  const user = req.user as JwtPayload | undefined;
  const userId = user?.userId;

  if (!userId) {
    res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
    });
    return;
  }

  // Verify ownership and load current state in one round-trip.
  const [row] = await mysqlDb
    .select({
      id: sessions.id,
      status: sessions.status,
      audioUrl: sessions.audioUrl,
    })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);

  if (!row) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Session not found' },
    });
    return;
  }

  // ── SSE headers ────────────────────────────────────────────────
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable response buffering on common reverse proxies so events
  // are flushed to the client immediately.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // If the session has already settled, replay terminal state and
  // close — there will be no further bus events to forward.
  if (row.status === 'ready') {
    send('progress', {
      step: 'done',
      progress: 100,
      message: 'Ready',
      audioUrl: row.audioUrl ?? undefined,
    } satisfies ProgressEvent);
    send('close', { reason: 'already_ready' });
    res.end();
    return;
  }
  if (row.status === 'failed') {
    send('progress', {
      step: 'error',
      progress: 0,
      message: 'Generation failed',
    } satisfies ProgressEvent);
    send('close', { reason: 'failed' });
    res.end();
    return;
  }

  // Send an initial `queued` event so the client immediately has
  // something to render rather than waiting for the first worker tick.
  send('progress', {
    step: 'queued',
    progress: 0,
    message: 'Waiting in queue...',
  } satisfies ProgressEvent);

  let ended = false;
  const finish = (reason: string): void => {
    if (ended) return;
    ended = true;
    unsubscribe();
    clearInterval(ping);
    clearTimeout(hardTimeout);
    if (!res.writableEnded) {
      try {
        send('close', { reason });
      } catch {
        // Connection may already be torn down — ignore.
      }
      res.end();
    }
  };

  const unsubscribe = generationBus.onProgress(sessionId, (event) => {
    if (ended) return;
    try {
      send('progress', event);
    } catch (err) {
      logger.warn({ err, sessionId }, 'Failed to write SSE progress event');
      finish('write_error');
      return;
    }
    if (event.step === 'done' || event.step === 'error') {
      finish(event.step);
    }
  });

  const ping = setInterval(() => {
    // SSE comment lines start with ":" and are ignored by clients.
    if (!res.writableEnded) {
      res.write(': ping\n\n');
    }
  }, SSE_KEEPALIVE_MS);

  const hardTimeout = setTimeout(() => finish('timeout'), SSE_TIMEOUT_MS);

  req.on('close', () => {
    logger.debug({ sessionId, userId }, 'SSE client disconnected');
    finish('client_closed');
  });
}
