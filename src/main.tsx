import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './lib/auth-context'

import "./main.css"

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
