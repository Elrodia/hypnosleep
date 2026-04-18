/**
 * Thin typed wrapper around `fetch` for the HypnoSleep backend.
 *
 * The backend speaks a uniform envelope:
 *   - success: `{ data, meta? }`
 *   - error:   `{ error: { code, message, details? } }`
 *
 * `apiFetch<T>` unwraps `data`, throws a typed {@link ApiError} for
 * non-2xx responses, and on 401 clears the stored JWT and dispatches
 * an `auth:unauthorized` window event so the auth context can boot the
 * user back to the landing page with a toast.
 *
 * All session-identifying inputs are URL-encoded and all callers go
 * through this wrapper, so adding JWT injection, logging or error
 * monitoring in the future is a one-file change.
 */

import { getAuthToken, clearAuthToken } from './auth'

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'headers'> {
  /** Optional JSON body; stringified automatically. */
  body?: unknown
  /** Additional headers to merge on top of the defaults. */
  headers?: Record<string, string>
  /**
   * When true, returns the full envelope `{ data, meta }` so callers can
   * read pagination metadata. Default is `false` — only `data` is
   * returned.
   */
  withMeta?: boolean
  /** When true, do not include the Authorization header. */
  skipAuth?: boolean
  /**
   * When true, a 401 response does NOT trigger the global logout
   * handler. Used only by the initial `/api/auth/me` probe where a 401
   * is an expected "not logged in" signal.
   */
  allow401?: boolean
}

/**
 * Dispatch the unauthorized event once per run so repeated 401s
 * don't produce duplicate toasts. Resets on successful requests so a
 * subsequent expiry re-triggers the boot-to-landing behaviour.
 */
let unauthorizedDispatched = false

function dispatchUnauthorized(): void {
  if (unauthorizedDispatched) return
  unauthorizedDispatched = true
  try {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  } catch {
    /* ignore */
  }
}

function resetUnauthorized(): void {
  unauthorizedDispatched = false
}

export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, withMeta, skipAuth, allow401, ...rest } = opts

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers ?? {}),
  }

  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] ?? 'application/json'
  }

  if (!skipAuth) {
    const token = getAuthToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  const res = await fetch(path, {
    ...rest,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  })

  // 204 No Content — common for DELETE. Return `undefined as T`; callers
  // that expect a body should not opt into this path.
  if (res.status === 204) {
    resetUnauthorized()
    return undefined as T
  }

  let payload: unknown = null
  const ct = res.headers.get('Content-Type') ?? ''
  if (ct.includes('application/json')) {
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
  }

  if (res.status === 401 && !allow401) {
    clearAuthToken()
    dispatchUnauthorized()
  }

  if (!res.ok) {
    const err =
      payload && typeof payload === 'object' && 'error' in payload
        ? ((payload as { error: ApiErrorBody }).error ?? {
            code: 'UNKNOWN',
            message: `HTTP ${res.status}`,
          })
        : { code: 'UNKNOWN', message: `HTTP ${res.status}` }
    throw new ApiError(res.status, err as ApiErrorBody)
  }

  resetUnauthorized()

  if (withMeta) {
    return (payload ?? {}) as T
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}

/**
 * Build a query string from a record of primitives. `undefined` /
 * `null` values are omitted. Empty object → empty string (no `?`).
 */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}
