import { EventEmitter } from 'node:events';

/**
 * Discrete steps a generation job moves through. Mirrors the
 * progress phases reported by the audio worker.
 */
export type ProgressStep =
  | 'queued'
  | 'script'
  | 'tts'
  | 'mix'
  | 'upload'
  | 'done'
  | 'error';

/**
 * A single progress update emitted by the worker and forwarded to
 * any SSE subscribers for the matching session.
 */
export interface ProgressEvent {
  step: ProgressStep;
  /** 0–100 progress percentage. */
  progress: number;
  /** Human-readable message safe to surface to the user. */
  message: string;
  /** Present on `done`: the public/streaming audio URL. */
  audioUrl?: string;
  /** Present on `error`: short error description (no internals). */
  error?: string;
}

/**
 * In-process event bus that bridges worker progress updates to SSE
 * handlers in the API.
 *
 * **Why in-process?** Railway runs the API + worker in a single
 * process (see `server.ts`), so a plain Node `EventEmitter` is the
 * lightest viable transport. If we ever split the worker into a
 * separate dyno, swap this for Redis pub/sub (publish on
 * `progress:{sessionId}`) — the public surface (`emitProgress` /
 * `onProgress`) is intentionally narrow so that switch only touches
 * this file.
 */
class GenerationEventBus extends EventEmitter {
  /** Emit a progress event for a specific session. */
  emitProgress(sessionId: string, payload: ProgressEvent): void {
    this.emit(`progress:${sessionId}`, payload);
  }

  /**
   * Subscribe to progress updates for a specific session. Returns an
   * `unsubscribe` function that callers (e.g. SSE handlers) MUST call
   * on disconnect to avoid leaking listeners.
   */
  onProgress(
    sessionId: string,
    listener: (event: ProgressEvent) => void,
  ): () => void {
    const channel = `progress:${sessionId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

export const generationBus = new GenerationEventBus();

/**
 * Redis key used to mirror the most recent {@link ProgressEvent} for a
 * session. Centralised here so the worker (writer) and the SSE handler
 * + sessions service (readers) all agree on the exact key format and
 * a single refactor changes them in lock-step.
 */
export function progressMirrorKey(sessionId: string): string {
  return `session:progress:${sessionId}`;
}

// Many concurrent users may subscribe simultaneously. The default
// max-listener cap (10) would print noisy warnings well before we
// reach a meaningful scale, so raise it to a value that comfortably
// covers MVP traffic. Each subscriber unsubscribes on disconnect, so
// listener count tracks active SSE clients.
generationBus.setMaxListeners(1000);
