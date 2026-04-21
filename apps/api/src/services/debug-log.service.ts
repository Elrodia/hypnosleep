import type { Request } from 'express';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { pgDb } from '../db/postgres/client.js';
import {
  debugEvents,
  type DebugEvent,
  type NewDebugEvent,
} from '../db/postgres/schema/debug-events.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { hashIp, isValidRequestId } from '../middleware/request-id.js';

/**
 * Coarse-grained buckets the debug-event store is indexed on. Used by
 * the admin filter endpoint and for at-a-glance grouping in the UI.
 */
export type DebugEventCategory =
  | 'oauth'
  | 'subscription'
  | 'ai'
  | 'http_4xx'
  | 'http_5xx'
  | 'worker'
  | 'other';

export type DebugEventLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface RecordDebugEventInput {
  /** Request correlation id. Invalid values are silently replaced with `'unknown'`. */
  rid: string | undefined;
  level: DebugEventLevel;
  category: DebugEventCategory;
  reason?: string | null;
  message: string;
  userId?: string | null;
  /**
   * Free-form structured context. Will be defensively redacted before
   * insert — see {@link redactForDebugEvent}. Callers should NOT pre-
   * serialize this to string.
   */
  context?: Record<string, unknown> | null;
  error?: unknown;
  httpStatus?: number | null;
  method?: string | null;
  path?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

interface SinkForwardPayload {
  id: string | null;
  rid: string;
  level: DebugEventLevel;
  category: DebugEventCategory;
  reason: string | null;
  message: string;
  userId: string | null;
  context: unknown;
  errorName: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  httpStatus: number | null;
  method: string | null;
  path: string | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: string;
  service: 'hypnosleep-api';
  env: string;
}

/** Substring markers that indicate a field is sensitive and should be dropped. */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /authorization/i,
  /cookie/i,
  /set-cookie/i,
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /client[-_]?secret/i,
  /refresh[-_]?token/i,
  /access[-_]?token/i,
  /id[-_]?token/i,
  /session[-_]?id/i,
  /stripecustomerid/i,
  /email/i, // emails are PII; keep them out of debug dumps
  /^code$/i, // OAuth authorization code
];

const REDACTED = '[REDACTED]';
const MAX_STRING_LEN = 2048;
const MAX_DEPTH = 6;
const MAX_KEYS_PER_OBJECT = 64;
const MAX_ARRAY_LEN = 64;
const MAX_MESSAGE_LEN = 1024;
const MAX_ERR_MSG_LEN = 1024;
const MAX_PATH_LEN = 512;
const MAX_UA_LEN = 512;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function clampString(value: string, max: number = MAX_STRING_LEN): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[+${value.length - max}ch]`;
}

/**
 * Recursively strips sensitive keys and truncates oversized strings.
 * Public for testing. Never throws; circular references short-circuit
 * to `'[Circular]'` so one bad context object can't poison logging.
 */
export function redactForDebugEvent(input: unknown): unknown {
  const seen = new WeakSet<object>();
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > MAX_DEPTH) return '[MaxDepth]';
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === 'string') return clampString(value as string);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return value;
    if (t === 'function' || t === 'symbol') return undefined;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) {
      return {
        name: value.name,
        message: clampString(value.message, MAX_ERR_MSG_LEN),
        // Stacks can legitimately include tokens embedded in URLs, so
        // keep them out of the structured context (we still log them
        // to stdout via Pino at record time, which has its own redact).
      };
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      const out = value
        .slice(0, MAX_ARRAY_LEN)
        .map((item) => walk(item, depth + 1));
      if (value.length > MAX_ARRAY_LEN) {
        out.push(`…[+${value.length - MAX_ARRAY_LEN} more]`);
      }
      return out;
    }
    if (t === 'object') {
      if (seen.has(value as object)) return '[Circular]';
      seen.add(value as object);
      const entries = Object.entries(value as Record<string, unknown>);
      const out: Record<string, unknown> = {};
      let kept = 0;
      for (const [k, v] of entries) {
        if (kept >= MAX_KEYS_PER_OBJECT) {
          out['…'] = `[+${entries.length - kept} more]`;
          break;
        }
        if (isSensitiveKey(k)) {
          out[k] = REDACTED;
        } else {
          out[k] = walk(v, depth + 1);
        }
        kept += 1;
      }
      return out;
    }
    return String(value);
  };
  return walk(input, 0);
}

function extractErrorFields(err: unknown): {
  errorName: string | null;
  errorMessage: string | null;
  errorCode: string | null;
} {
  if (!err) return { errorName: null, errorMessage: null, errorCode: null };
  if (err instanceof Error) {
    const code = (err as Error & { code?: unknown }).code;
    return {
      errorName: err.name || null,
      errorMessage: clampString(err.message, MAX_ERR_MSG_LEN),
      errorCode:
        typeof code === 'string' || typeof code === 'number'
          ? String(code).slice(0, 64)
          : null,
    };
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : null;
    const message = typeof o.message === 'string' ? clampString(o.message, MAX_ERR_MSG_LEN) : null;
    const code =
      typeof o.code === 'string' || typeof o.code === 'number' ? String(o.code).slice(0, 64) : null;
    return { errorName: name, errorMessage: message, errorCode: code };
  }
  return { errorName: null, errorMessage: clampString(String(err), MAX_ERR_MSG_LEN), errorCode: null };
}

export function classifyHttpCategory(status: number): DebugEventCategory {
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_4xx';
  return 'other';
}

// ─── Health metrics ───────────────────────────────────────────────────────
// Tracked in-process so `/api/health/debug` can surface them without
// round-tripping back to the store. Bounded so they don't grow.
interface DebugLogHealth {
  lastWriteAt: string | null;
  lastWriteDurationMs: number | null;
  lastWriteError: string | null;
  totalWrites: number;
  totalFailures: number;
  lastPruneAt: string | null;
  lastPruneDeleted: number | null;
  lastPruneError: string | null;
  lastSinkAt: string | null;
  lastSinkError: string | null;
}

const health: DebugLogHealth = {
  lastWriteAt: null,
  lastWriteDurationMs: null,
  lastWriteError: null,
  totalWrites: 0,
  totalFailures: 0,
  lastPruneAt: null,
  lastPruneDeleted: null,
  lastPruneError: null,
  lastSinkAt: null,
  lastSinkError: null,
};

export function getDebugLogHealth(): Readonly<DebugLogHealth> {
  return { ...health };
}

// ─── Recording ────────────────────────────────────────────────────────────

function normalizeRid(rid: string | undefined): string {
  if (isValidRequestId(rid)) return rid;
  return 'unknown';
}

function ipPepper(): string {
  return env.DEBUG_LOG_IP_HASH_PEPPER ?? env.JWT_SECRET;
}

/**
 * Persist a debug event and (best-effort) forward it to an external
 * log sink. Never throws — the caller is already on an error path and
 * mustn't be broken by a logging-system failure.
 */
export async function recordDebugEvent(input: RecordDebugEventInput): Promise<DebugEvent | null> {
  const rid = normalizeRid(input.rid);
  const redactedContext = input.context ? (redactForDebugEvent(input.context) as Record<string, unknown>) : null;
  const { errorName, errorMessage, errorCode } = extractErrorFields(input.error);
  const row: NewDebugEvent = {
    rid,
    level: input.level,
    category: input.category,
    reason: input.reason ? input.reason.slice(0, 64) : null,
    userId: input.userId ? input.userId.slice(0, 36) : null,
    message: clampString(input.message, MAX_MESSAGE_LEN),
    context: redactedContext,
    errorName: errorName ? errorName.slice(0, 128) : null,
    errorMessage,
    errorCode,
    httpStatus: typeof input.httpStatus === 'number' ? input.httpStatus : null,
    method: input.method ? input.method.slice(0, 8).toUpperCase() : null,
    path: input.path ? clampString(input.path.split('?', 1)[0], MAX_PATH_LEN) : null,
    userAgent: input.userAgent ? clampString(input.userAgent, MAX_UA_LEN) : null,
    ipHash: hashIp(input.ip ?? null, ipPepper()),
  };

  const start = Date.now();
  try {
    const inserted = await pgDb.insert(debugEvents).values(row).returning();
    const duration = Date.now() - start;
    health.lastWriteAt = new Date().toISOString();
    health.lastWriteDurationMs = duration;
    health.lastWriteError = null;
    health.totalWrites += 1;

    void forwardToSink(inserted[0] ?? null, row).catch(() => {
      // `forwardToSink` already logs and updates health; swallow here.
    });

    return inserted[0] ?? null;
  } catch (err) {
    health.totalFailures += 1;
    health.lastWriteError = err instanceof Error ? err.message : String(err);
    // Logging the failure at WARN is deliberate: a storage failure
    // must not cascade into a 5xx on the original request. We already
    // recorded the primary message via the caller's own `logger`.
    logger.warn(
      { err, rid, category: input.category, reason: input.reason },
      'Failed to persist debug event',
    );
    return null;
  }
}

/**
 * Convenience helper that extracts the common request fields. Used by
 * the global error handler and by `logOAuthFailure`.
 */
export function extractRequestContext(req: Request): {
  rid: string | undefined;
  method: string;
  path: string;
  userAgent: string | null;
  ip: string | null;
  userId: string | null;
} {
  return {
    rid: req.rid,
    method: req.method,
    path: req.path || req.originalUrl || '',
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    ip: req.ip ?? null,
    userId: req.userId ?? null,
  };
}

// ─── Sink forwarder (optional, Tier 3) ────────────────────────────────────

async function forwardToSink(saved: DebugEvent | null, fallback: NewDebugEvent): Promise<void> {
  const url = env.DEBUG_LOG_SINK_URL;
  if (!url) return;
  const payload: SinkForwardPayload = {
    id: saved?.id ?? null,
    rid: saved?.rid ?? fallback.rid,
    level: (saved?.level ?? fallback.level) as DebugEventLevel,
    category: (saved?.category ?? fallback.category) as DebugEventCategory,
    reason: saved?.reason ?? fallback.reason ?? null,
    message: saved?.message ?? fallback.message,
    userId: saved?.userId ?? fallback.userId ?? null,
    context: saved?.context ?? fallback.context ?? null,
    errorName: saved?.errorName ?? fallback.errorName ?? null,
    errorMessage: saved?.errorMessage ?? fallback.errorMessage ?? null,
    errorCode: saved?.errorCode ?? fallback.errorCode ?? null,
    httpStatus: saved?.httpStatus ?? fallback.httpStatus ?? null,
    method: saved?.method ?? fallback.method ?? null,
    path: saved?.path ?? fallback.path ?? null,
    userAgent: saved?.userAgent ?? fallback.userAgent ?? null,
    ipHash: saved?.ipHash ?? fallback.ipHash ?? null,
    createdAt: (saved?.createdAt ?? new Date()).toISOString(),
    service: 'hypnosleep-api',
    env: env.NODE_ENV,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (env.DEBUG_LOG_SINK_TOKEN) {
      headers['authorization'] = `Bearer ${env.DEBUG_LOG_SINK_TOKEN}`;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`sink responded ${res.status}`);
    }
    health.lastSinkAt = new Date().toISOString();
    health.lastSinkError = null;
  } catch (err) {
    health.lastSinkError = err instanceof Error ? err.message : String(err);
    logger.warn({ err, url }, 'Debug log sink forward failed');
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Query API (admin only — callers must gate) ───────────────────────────

export interface ListDebugEventsOptions {
  category?: DebugEventCategory;
  userId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
}

const MAX_LIST_LIMIT = 200;

export async function listDebugEvents(
  opts: ListDebugEventsOptions,
): Promise<DebugEvent[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), MAX_LIST_LIMIT);
  const where = [];
  if (opts.category) where.push(eq(debugEvents.category, opts.category));
  if (opts.userId) where.push(eq(debugEvents.userId, opts.userId));
  if (opts.since) where.push(gte(debugEvents.createdAt, opts.since));
  if (opts.until) where.push(lt(debugEvents.createdAt, opts.until));
  const whereClause = where.length ? and(...where) : undefined;
  const rows = await pgDb
    .select()
    .from(debugEvents)
    .where(whereClause)
    .orderBy(desc(debugEvents.createdAt), desc(debugEvents.id))
    .limit(limit);
  return rows;
}

export async function getDebugEventsByRid(rid: string): Promise<DebugEvent[]> {
  if (!rid) return [];
  return pgDb
    .select()
    .from(debugEvents)
    .where(eq(debugEvents.rid, rid))
    .orderBy(debugEvents.createdAt);
}

// ─── Retention ────────────────────────────────────────────────────────────

export async function pruneOldDebugEvents(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  try {
    const result = await pgDb
      .delete(debugEvents)
      .where(lt(debugEvents.createdAt, cutoff))
      .returning({ id: debugEvents.id });
    const deleted = result.length;
    health.lastPruneAt = new Date().toISOString();
    health.lastPruneDeleted = deleted;
    health.lastPruneError = null;
    return deleted;
  } catch (err) {
    health.lastPruneError = err instanceof Error ? err.message : String(err);
    logger.warn({ err, retentionDays }, 'Failed to prune debug events');
    return 0;
  }
}

const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // hourly
/**
 * Delay on first boot before running the initial prune. Chosen to let
 * the API finish its warm-up (DB pool, Redis handshake, queue worker
 * startup) so the prune's DELETE doesn't contend with higher-priority
 * init work on a cold boot.
 */
const PRUNE_STARTUP_DELAY_MS = 30_000;

export function startDebugEventsPruneJob(): NodeJS.Timeout {
  const run = (): void => {
    void pruneOldDebugEvents(env.DEBUG_LOG_RETENTION_DAYS);
  };
  const startupTimer = setTimeout(run, PRUNE_STARTUP_DELAY_MS);
  startupTimer.unref();
  const timer = setInterval(run, PRUNE_INTERVAL_MS);
  timer.unref();
  return timer;
}

// ─── Sampling helper for 4xx capture ──────────────────────────────────────

export function shouldSample4xx(): boolean {
  const rate = env.DEBUG_LOG_SAMPLE_4XX_RATE;
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return Math.random() < rate;
}

// Re-export for convenience
export { sql };
