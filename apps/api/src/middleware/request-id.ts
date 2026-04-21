import { createHash, randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Per-request correlation id. Populated by `requestId` middleware.
     * UUIDv4 — either supplied by a trusted upstream (Cloudflare,
     * Railway) via `X-Request-Id` or generated fresh. Echoed in the
     * `X-Request-Id` response header and used as the primary key
     * stitching OAuth state, access logs, debug events, and the
     * "Support reference" shown on the auth error page together.
     */
    rid?: string;
    /** Child logger bound to `{ rid }` for the request lifetime. */
    log?: typeof logger;
  }
}

/**
 * Accepts a UUIDv4 in canonical `8-4-4-4-12` hex form. We purposely
 * narrow to v4 rather than allowing any 36-char string so a spoofed
 * header cannot inject a newline into log output (`\r\n` would split
 * a line into a forged log record) or overflow downstream varchar
 * columns.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

function pickInboundRid(req: Request): string | null {
  // Only accept one header value — arrays (injected upstream) are a
  // smuggling vector.
  const raw = req.headers['x-request-id'];
  if (typeof raw === 'string' && isValidRequestId(raw)) return raw;
  return null;
}

/**
 * Express middleware that guarantees every request has a correlation
 * id (`req.rid`) and a `{ rid }`-bound child logger (`req.log`), and
 * echoes the id to the client via the `X-Request-Id` response header.
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rid = pickInboundRid(req) ?? randomUUID();
    req.rid = rid;
    req.log = logger.child({ rid });
    res.setHeader('X-Request-Id', rid);
    next();
  };
}

/**
 * Helper to hash a client IP for inclusion in debug events.
 * `sha256(ip + pepper)` — never the raw IP. Returns `null` when no
 * IP is available (which is the common case in unit tests).
 */
export function hashIp(ip: string | null | undefined, pepper: string): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${ip}:${pepper}`).digest('hex');
}
