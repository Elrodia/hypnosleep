import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { forbidden, unauthenticated } from '../utils/errors.js';

/**
 * Parse `ADMIN_USER_IDS` once at import time. Comma- or whitespace-
 * separated list of UUIDv4 user ids. Blank entries are tolerated so
 * that `"id-a, id-b,"` or `"id-a id-b"` work equivalently.
 */
function parseAdminIds(raw: string | undefined): ReadonlySet<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

const ADMIN_IDS = parseAdminIds(env.ADMIN_USER_IDS);

/**
 * Test-only reset hook. We parse the env allowlist at module load so
 * the production hot path doesn't re-parse on every request; tests
 * that need to flip the allowlist can mutate `ADMIN_USER_IDS` and
 * then call `__refreshAdminIdsForTests()` to reload.
 */
export function isAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  return ADMIN_IDS.has(userId);
}

/**
 * Express middleware that gates a route behind the admin allowlist.
 * Must run **after** `requireAuth` so `req.userId` is populated.
 *
 * Returns 401 when no user is on the request (i.e. the upstream
 * auth middleware was skipped by misconfiguration) and 403 when the
 * authenticated user is not on `ADMIN_USER_IDS`. Never leaks whether
 * the allowlist is empty — an empty list denies everyone.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.userId;
  if (!userId) {
    next(unauthenticated('Authentication required'));
    return;
  }
  if (!isAdmin(userId)) {
    next(forbidden('Admin access required'));
    return;
  }
  next();
}
