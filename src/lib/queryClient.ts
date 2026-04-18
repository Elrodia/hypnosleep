/**
 * Shared React Query client. Kept in its own module so tests (and
 * future tooling such as a devtools panel) can import the same
 * instance without circular imports through `App.tsx`.
 */

import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

/**
 * Do not retry on 4xx responses — they indicate a stable client-side
 * error (bad input, not authorized, etc.) and retrying just wastes
 * round-trips. Retry server/network errors a couple of times with a
 * default exponential backoff.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
})
