/**
 * Auth context — single source of truth for "who is the current user,
 * and are we still resolving that?". Previously this was a chunk of
 * `useState` + `useEffect` inside `App.tsx` plus per-page calls to
 * `fetchCurrentUser`. Centralising it means:
 *
 *   - Pages that need the user (Profile, Account, …) call `useAuth()`
 *     instead of re-fetching `/api/auth/me` on mount.
 *   - A 401 from any other endpoint boots the user back to the
 *     landing page exactly once, via the `auth:unauthorized` window
 *     event dispatched by {@link apiFetch}.
 *   - The protected app shell can be gated centrally on
 *     `status === 'authenticated'` instead of each page branching on
 *     a `user == null` state.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import {
  clearAuthToken,
  consumeOAuthCallback,
  getAuthToken,
} from './auth'
import { apiFetch, ApiError } from './api'
import type { ProfileUser } from './api-endpoints'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: ProfileUser | null
  status: AuthStatus
  /** Force a re-fetch of `/api/auth/me`. Used after login redirects. */
  refresh: () => Promise<void>
  /** Update the in-memory user after a successful profile mutation. */
  setUser: (user: ProfileUser | null) => void
  /** Best-effort logout: clears token, resets state, forwards to landing. */
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Fetch `/api/auth/me` and return the payload, or `null` if the user
 * is not authenticated. A 401 is an expected "not logged in" signal
 * on first boot, so we use the `allow401` escape hatch to avoid
 * dispatching the global unauthorized event for it.
 */
async function fetchMe(): Promise<ProfileUser | null> {
  const token = getAuthToken()
  if (!token) return null
  try {
    const data = await apiFetch<ProfileUser>('/api/auth/me', { allow401: true })
    return data
  } catch (err) {
    // A 401 here means the stored JWT is expired/invalid. `allow401`
    // suppresses the global unauthorized event (so no stray toast on
    // first boot), but we still need to clear the stale token — otherwise
    // downstream hooks like `useKV` see a token present and start
    // issuing authenticated requests that will all 401.
    if (err instanceof ApiError && err.status === 401) {
      clearAuthToken()
    }
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const initialisedRef = useRef(false)

  const refresh = useCallback(async () => {
    const next = await fetchMe()
    setUser(next)
    setStatus(next ? 'authenticated' : 'unauthenticated')
  }, [])

  const logout = useCallback(async () => {
    const token = getAuthToken()
    clearAuthToken()
    setUser(null)
    setStatus('unauthenticated')
    if (!token) return
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        skipAuth: true,
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      /* best-effort */
    }
  }, [])

  // Mount-time resolution: consume any `?token=...` from the OAuth
  // callback URL, then ask the backend who we are.
  useEffect(() => {
    if (initialisedRef.current) return
    initialisedRef.current = true
    consumeOAuthCallback()
    void refresh()
  }, [refresh])

  // Centralised 401 handling: if any API call returns 401 (e.g. the
  // JWT expired mid-session), clear state and surface a toast so the
  // user knows why they were booted.
  useEffect(() => {
    function onUnauthorized() {
      clearAuthToken()
      setUser(null)
      setStatus('unauthenticated')
      toast.error('Your session expired. Please sign in again.')
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => {
      window.removeEventListener('auth:unauthorized', onUnauthorized)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, refresh, setUser, logout }),
    [user, status, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
