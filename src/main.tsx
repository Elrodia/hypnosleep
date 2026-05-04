import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth-context'

import './i18n/config'
import "./main.css"

/**
 * Apply the persisted UI theme before React mounts so a returning
 * user doesn't see a flash of the wrong theme.
 *
 * Source of truth at runtime is the `useKV('theme')` hook (Redis-
 * backed, per-user) but that requires an authenticated network
 * round-trip we obviously can't await synchronously here. To bridge
 * the gap, the preferences page mirrors the chosen theme to
 * `localStorage['hypno-theme']` on every change; this bootstrap
 * reads that mirror so the very first paint already matches the
 * user's preference. New users get the default (dark) until they
 * pick.
 */
try {
  const theme = localStorage.getItem('hypno-theme')
  if (theme === 'light') {
    document.documentElement.classList.add('light')
  }
} catch {
  // localStorage may be unavailable (private mode, etc) — default theme.
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
   </ErrorBoundary>
)

// Register service worker for PWA support.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed — app still works without it.
    })
  })
}
