/**
 * Frontend auth helpers for the real backend at /api/auth/*.
 *
 * The backend issues JWT bearer tokens on successful OAuth callback and
 * redirects the browser to `${FRONTEND_URL}/auth/callback?token=<JWT>`.
 * We stash the token in localStorage and attach it to API calls via an
 * `Authorization: Bearer` header. `/api/auth/me` returns the current
 * user and is the source of truth for the logged-in state.
 */

const TOKEN_STORAGE_KEY = 'hs.auth.token'

export type OAuthProvider = 'google' | 'github' | 'microsoft'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  plan: string
  preferences: unknown
  referralCode: string | null
  referredBy: string | null
  createdAt: string
}

/** Read the stored JWT, if any. Safe for SSR / missing storage. */
export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persist a JWT returned by the backend OAuth callback. */
export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    /* storage unavailable (private mode, etc.) — ignore */
  }
}

/** Remove any stored JWT. */
export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Start an OAuth flow by doing a full-page navigation to the backend
 * initiation URL. Using `location.assign` (rather than `fetch`) is
 * required so the browser follows the provider's cross-site redirect
 * and cookies (e.g. the `oauth_state` CSRF cookie) flow correctly.
 *
 * Preserves any `?ref=<code>` referral parameter from the current URL
 * so the backend can attribute the referral after callback.
 */
export function startOAuth(provider: OAuthProvider): void {
  let url = `/api/auth/${provider}`
  try {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`
    }
  } catch {
    /* ignore — navigate without ref */
  }
  window.location.assign(url)
}

/**
 * Fetch the currently authenticated user from the backend.
 *
 * - Returns the user on 200.
 * - Returns `null` on 401 (not logged in) or any other non-OK response.
 *   Clears the stored token on 401 so stale tokens don't keep re-trying.
 * - Returns `null` if there's no stored token to avoid a guaranteed 401.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken()
  if (!token) return null

  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 401) {
      clearAuthToken()
      return null
    }
    if (!res.ok) return null

    const body = (await res.json()) as { data?: AuthUser }
    return body.data ?? null
  } catch {
    // Network failure — treat as unauthenticated without clobbering the
    // token, so a transient outage doesn't force a re-login.
    return null
  }
}

/**
 * Log out: best-effort call to the backend logout endpoint and
 * unconditionally drop the stored token locally.
 */
export async function logout(): Promise<void> {
  const token = getAuthToken()
  clearAuthToken()
  if (!token) return

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* best-effort */
  }
}

/**
 * If the current URL is the OAuth callback landing page
 * (`/auth/callback?token=...`), extract and persist the token, then
 * clean it out of the URL. Returns true if a token was consumed.
 *
 * Call this once on app startup, before checking `fetchCurrentUser`.
 */
export function consumeOAuthCallback(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.pathname !== '/auth/callback') return false

  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) return false

  setAuthToken(token)

  // Clean the token out of the URL so it doesn't show up in browser
  // history, referer headers, or screenshots.
  try {
    window.history.replaceState(null, '', '/')
  } catch {
    /* ignore */
  }
  return true
}

/**
 * If the current URL is the OAuth error landing page
 * (`/auth/error`), clean the URL and return true so the caller can
 * surface a user-visible message.
 */
export function consumeOAuthError(): boolean {
  if (typeof window === 'undefined') return false
  if (window.location.pathname !== '/auth/error') return false

  try {
    window.history.replaceState(null, '', '/')
  } catch {
    /* ignore */
  }
  return true
}
