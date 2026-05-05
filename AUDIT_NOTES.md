# HypnoSleep audit notes

Scope: backtest the existing codebase against expected product behavior, expose
silent failures, make narrow production-safe fixes. No cosmetic refactors, no
new features, no dependency churn beyond what was strictly required.

## Commands run

| Command | Where | Status |
|---|---|---|
| `npm install` | repo root | ✅ |
| `npm install` | `apps/api` | ✅ |
| `npm run build` | repo root (Vite + tsc) | ✅ |
| `npm run lint` | repo root (eslint) | ✅ — 0 errors, 18 pre-existing warnings (unchanged) |
| `npm run test:e2e -- --reporter=list` | repo root (Playwright) | ✅ — 9/9 after fix (was 7/9) |
| `npm run build` | `apps/api` (tsc) | ✅ |
| `npm run lint` | `apps/api` (eslint) | ✅ after fix (was failing: no config resolvable) |
| `npm run test` | `apps/api` (vitest) | ✅ — 245 pass, 14 skipped (was 6 failures, 1 file load error) |

## Inspected surface (Phase 1 map)

- **Frontend** (`src/`): Vite + React 19, lazy `LandingPage` and main app shell (`App.tsx`), auth context (`src/lib/auth-context.tsx`), TanStack Query, audio player + generation contexts, Sonner toasts, modals (Sleep timer, Sounds, Script editor, Report session, Daily reminder, Feedback, Paywall, FullScreenPlayer, OnboardingCarousel). i18n via `react-i18next` with `src/i18n/locales/`.
- **API** (`apps/api/src/`): Express 4 + TypeScript, `routes.ts` mounts module routers; middleware order = request-id → helmet → CORS → rate-limit → auth (per route). Modules: `auth` (Passport Google/GitHub/Microsoft), `profile`, `sessions`, `progress`, `ai` (Gemini guard + safety), `audio` (TTS + queue + R2/S3), `notifications`, `subscription` (Stripe), `kv`, `admin/debug`. Drizzle ORM for both Postgres (analytics, mood, streaks, weekly insights, debug events) and MySQL (sessions, audio assets). BullMQ with Redis fallback.
- **Tests**: Playwright e2e under `tests/e2e/` (landing + pricing); Vitest under `apps/api/tests/` covering middleware, modules, schemas, services. CI in `.github/workflows/ci.yml` boots MySQL/Postgres/Redis services and provides placeholder env values.

## Critical / High issues found and fixed

### 1. API `progress` test suite broken (6 failures) — High

**Root cause**: `progress.service.ts` was refactored to wrap streak updates in
`pgDb.transaction(...)` and `progress.insights.ts` started selecting
`{ id, category }` from MySQL sessions, but the `vi.mock` fakes in
`tests/modules/progress/progress.test.ts` were never updated:
- `pgDb` mock had no `transaction` method → `TypeError: pgDb.transaction is not a function` (5 tests).
- `pgDb.insert(...).onConflictDoNothing()` did not exist on the fake.
- `mysqlDb` mock projected only `{ category }`, dropping `id`, so
  `progress.insights` could not weight categories by play count → the
  generated prompt said `varied` instead of `sleep` (1 test).

**Fix**: Updated only the test mocks to mirror the production query surface
exactly:
- Added `transaction(fn)` on the in-test `pgDb` mock that runs `fn` against
  the same fake (sufficient for unit tests of in-memory state).
- Added `.onConflictDoNothing()` chain step that snapshots prior streak rows
  and rolls back inserts that hit an existing primary key, matching Postgres
  semantics.
- Returned `id` alongside `category` in the MySQL category-projection branch
  so `progress.insights` can correctly count plays per category.

Production code was **not** changed.

### 2. API `vitest` could not load `tests/config/env.test.ts` — High

**Root cause**: `src/config/env.ts` calls `loadEnv()` at module load
(`export const env = loadEnv()`), which throws `INVALID_ENV` if any required
variable is missing. The test file imported `@/config/env` directly, but no
test setup populated `process.env`, so the file failed to load before any
test could run (vitest reported `(0 test)` and a failure).

**Fix**: Added `apps/api/tests/setup.env.ts` that injects test-safe
**non-secret placeholder** values for required variables (DATABASE_URL,
MYSQL_URL, JWT_SECRET, GEMINI_API_KEY, OAuth client IDs/secrets, S3, Stripe).
Wired it via `setupFiles: ['./tests/setup.env.ts']` in
`apps/api/vitest.config.ts`. Values mirror what CI already provides — they
are obvious placeholders, never real credentials.

### 3. API `npm run lint` script always failed — Medium

**Root cause**: `apps/api/package.json` runs `eslint src/`, but there is no
ESLint config in `apps/api/`. ESLint walks up to the root `eslint.config.js`,
which contains `ignores: ["dist", "apps"]` — so every file under `apps/api/src`
was ignored, producing a fatal "all files are ignored" error.

**Fix**: Added a minimal `apps/api/eslint.config.js` that uses the already
hoisted root `eslint` and `typescript-eslint` (no new devDeps), targeting
`src/**/*.ts`. Disabled `@typescript-eslint/no-namespace` for the
`declare global { namespace Express { ... } }` Express type-augmentation
pattern (canonical and unrelated to runtime behavior). Removed two unused
imports the lint pass surfaced:
- `logger` in `src/middleware/rate-limit.ts`
- `sql` in `src/modules/progress/progress.insights.ts`

### 4. Playwright landing-page tests asserted on stale copy — High

**Root cause**: `tests/e2e/landing.spec.ts` expected
`heading: /welcome to hypnosleep/i` after clicking the hero CTA / nav login
link. The actual `LoginPage` Liminal-direction copy is the lowercase
`welcome.` heading (`src/i18n/locales/en.json:208`,
`src/components/pages/LoginPage.tsx:38`), so 2/9 tests failed unconditionally
on every run.

**Fix**: Anchored the post-click assertions on the OAuth provider buttons
(`continue with google`, `continue with github`) which are stable and
genuinely identify the login screen. Did **not** change the LoginPage
heading — preserving the Liminal Space lowercase typography is a deliberate
design choice (see Phase 9 / repo memory `styling`).

## Functional backtest (selected)

| Flow | Backtest result |
|---|---|
| Landing renders + primary CTAs enabled | ✅ (e2e) |
| Landing → Login flow reaches OAuth buttons | ✅ (e2e, after fix) |
| Pricing copy is internally consistent | ✅ (e2e) |
| API auth middleware rejects bad/missing tokens | ✅ (vitest) |
| AI safety guard blocks medical/illegal content | ✅ (vitest, ai service tests) |
| Stripe webhook rejects unsigned requests | ✅ (vitest) |
| Progress streak math (same day / +1 / gap) | ✅ (vitest, after mock fix) |
| Weekly insight prompt includes top category + count | ✅ (vitest, after mock fix) |
| Redis helper falls back when REDIS_URL is unset | ✅ (vitest) |
| MySQL/Postgres schemas match Drizzle types | ✅ (vitest schema-check) |

## Frontend ↔ API contract spot-check

Browsed `src/lib/api.ts`, `src/lib/api-endpoints.ts`, and matched them
against `apps/api/src/routes.ts` and the per-module `*.routes.ts`. Every
endpoint constant maps to a registered backend route with a consistent
HTTP method and auth requirement. No mismatches surfaced during this
review window.

## Security audit (Phase 5)

Spot-checked, nothing fixed because nothing was found to be regressed:

- `.env.production` contains placeholders only — no real secrets.
- Stripe webhook uses raw-body verification (`subscription.webhook.ts`).
- JWT verification uses signed `verify(...)` with expiry honored.
- OAuth state/transaction is checked on callback (`auth.controller.ts`).
- Helmet, rate-limit, and CORS are wired in `routes.ts`.
- No tokens, OAuth state, or DB URLs are logged at info level.
- Service worker (`public/sw.js`) explicitly skips `/api/*` and audio URLs.

## Intentionally unresolved (need real credentials / infrastructure)

These are not defects; they require external services and are correctly
skipped in CI:

- `tests/modules/audio/audio.integration.test.ts` — gated on
  `SKIP_INTEGRATION=false`; requires a real S3/R2 endpoint.
- `tests/modules/audio/audio.mixer.fade.integration.test.ts` — same.
- `tests/smoke.test.ts` — gated on `SMOKE_API_URL`; runs against a deployed
  API.
- `npm run test:live-ai` — requires `RUN_LIVE_AI=1` and a real
  `GEMINI_API_KEY`.
- Redis-backed rate limiting and BullMQ workers degrade to in-memory when
  `REDIS_URL` is absent. This is the documented graceful-degradation path,
  not a defect.

## Files changed

- `apps/api/tests/modules/progress/progress.test.ts` — mock fixes (transaction, onConflictDoNothing, MySQL `id` projection).
- `apps/api/tests/setup.env.ts` — **new**: test-safe env placeholders.
- `apps/api/vitest.config.ts` — wired `setupFiles`.
- `apps/api/eslint.config.js` — **new**: minimal API lint config.
- `apps/api/src/middleware/rate-limit.ts` — removed unused `logger` import.
- `apps/api/src/modules/progress/progress.insights.ts` — removed unused `sql` import.
- `tests/e2e/landing.spec.ts` — anchored post-click assertions on OAuth buttons (stable across copy changes).
- `AUDIT_NOTES.md` — this document.

## Smoke-check commands for the reviewer

```bash
# Frontend
npm install
npm run build
npm run lint
npm run test:e2e -- --reporter=list

# API
cd apps/api
npm install
npm run build
npm run lint
npm run test
```

All commands above currently exit 0 in this branch.
