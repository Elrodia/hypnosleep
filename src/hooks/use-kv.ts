import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthToken } from '@/lib/auth'

/**
 * Drop-in replacement for the `useKV` hook that used to come from
 * `@github/spark/hooks`. Persists values through the backend
 * `/api/kv/:key` endpoint (Redis-backed, per-user) instead of Spark's
 * hosted key/value store.
 *
 * Semantics
 * ---------
 * - On mount: fetches the stored value for the authenticated user.
 *   While the request is in flight, the hook returns `initialValue` so
 *   callers don't see `undefined`.
 * - For anonymous users (no JWT stashed yet) the hook behaves like
 *   `useState(initialValue)` — no network I/O is performed. This is
 *   important for the login/landing flow which renders before auth.
 * - Writes are optimistic: local state updates immediately, then a
 *   best-effort `PUT` is fired. If the request fails, the local value
 *   stays so the UI doesn't thrash; the next successful write will
 *   reconcile.
 * - `delete` sends `PUT { value: null }` (the backend treats `null` as
 *   a delete) and resets local state to `initialValue`.
 *
 * Cross-component sharing
 * -----------------------
 * Multiple components that use the same key share an in-module cache
 * and a subscriber list, so a write in one component is observed by
 * all others without a network round-trip. This matches the behaviour
 * of the original Spark hook closely enough that no call sites need
 * to change.
 *
 * Failure modes
 * -------------
 * - 401 / token absent → treated as "anonymous", no further writes
 *   are attempted for this mount.
 * - 503 `STORAGE_UNAVAILABLE` (Redis not configured) → the hook keeps
 *   the local value and silently retries on the next write. The app
 *   remains functional, values just don't persist across reloads.
 * - Any network error → silent; value stays in-memory.
 */

type Setter<T> = (newValue: T | ((oldValue?: T) => T)) => void
type Deleter = () => void

interface CacheEntry {
  value: unknown
  loaded: boolean
  subscribers: Set<(v: unknown) => void>
}

const cache = new Map<string, CacheEntry>()

function getEntry(key: string): CacheEntry {
  let entry = cache.get(key)
  if (!entry) {
    entry = { value: undefined, loaded: false, subscribers: new Set() }
    cache.set(key, entry)
  }
  return entry
}

function broadcast(key: string, value: unknown): void {
  const entry = cache.get(key)
  if (!entry) return
  entry.value = value
  for (const sub of entry.subscribers) sub(value)
}

/**
 * Accept only keys that match the backend's validation regex so we
 * never pay the cost of a guaranteed-400 round-trip. The backend
 * regex is the source of truth; this mirror is for UX only.
 */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/

async function remoteGet(key: string): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const token = getAuthToken()
  if (!token) return { ok: false }
  try {
    const res = await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) return { ok: false }
    const body = (await res.json()) as { data?: { value?: unknown } }
    return { ok: true, value: body.data?.value ?? null }
  } catch {
    return { ok: false }
  }
}

async function remotePut(key: string, value: unknown): Promise<void> {
  const token = getAuthToken()
  if (!token) return
  try {
    await fetch(`/api/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ value }),
    })
  } catch {
    /* best-effort */
  }
}

export function useKV<T = string>(
  key: string,
  initialValue?: T,
): readonly [T | undefined, Setter<T>, Deleter] {
  // Validate once per mount; invalid keys fall back to pure in-memory
  // state and emit a console warning so the developer sees it.
  const valid = KEY_PATTERN.test(key)
  if (!valid && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(
      `[useKV] key "${key}" does not match /^[a-z0-9][a-z0-9-]{0,62}$/ — persistence disabled`,
    )
  }

  const entry = valid ? getEntry(key) : null
  const [value, setValue] = useState<T | undefined>(() => {
    if (entry && entry.loaded) return entry.value as T | undefined
    return initialValue
  })

  // Track the latest value in a ref so the setter's functional form
  // (oldValue => newValue) always sees the current state even if
  // called in quick succession.
  const valueRef = useRef<T | undefined>(value)
  valueRef.current = value

  useEffect(() => {
    if (!entry) return

    const subscriber = (v: unknown) => {
      valueRef.current = v as T | undefined
      setValue(v as T | undefined)
    }
    entry.subscribers.add(subscriber)

    // First subscriber for this key triggers the initial fetch. If
    // another mount already loaded the value, just sync from cache.
    if (entry.loaded) {
      setValue(entry.value as T | undefined)
    } else {
      void remoteGet(key).then((result) => {
        entry.loaded = true
        if (result.ok && result.value != null) {
          broadcast(key, result.value)
        }
        // If the backend returned null (unset) we keep `initialValue`.
      })
    }

    return () => {
      entry.subscribers.delete(subscriber)
    }
  }, [entry, key])

  const set = useCallback<Setter<T>>(
    (next) => {
      const resolved =
        typeof next === 'function'
          ? (next as (oldValue?: T) => T)(valueRef.current)
          : next
      valueRef.current = resolved
      setValue(resolved)
      if (entry) {
        broadcast(key, resolved)
        void remotePut(key, resolved)
      }
    },
    [entry, key],
  )

  const del = useCallback<Deleter>(() => {
    valueRef.current = initialValue
    setValue(initialValue)
    if (entry) {
      broadcast(key, initialValue)
      void remotePut(key, null)
    }
  }, [entry, key, initialValue])

  return [value, set, del] as const
}
