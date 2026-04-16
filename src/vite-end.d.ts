/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string | undefined
  readonly VITE_STRIPE_MONTHLY_LINK: string | undefined
  readonly VITE_STRIPE_ANNUAL_LINK: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}