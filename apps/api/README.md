# HypnoSleep API

Express + Drizzle backend for HypnoSleep.

## Deployment — unified Railway service

In production the Vite SPA and this Express API are shipped as a
**single Railway service** behind one domain (`https://app.hypnosleep.app`).
The top-level `Dockerfile` and `railway.toml` at the repo root drive the
build:

1. Stage 1 builds the Vite SPA (`npm run build` at the repo root → `dist/`).
2. Stage 2 builds this API (`tsc -b` → `apps/api/dist/`).
3. Stage 3 runs `node dist/server.js`. Express mounts `/api/*` and then
   serves the built SPA from `STATIC_DIR` with an SPA fallback, so
   `https://app.hypnosleep.app/api/auth/google/callback` and
   `https://app.hypnosleep.app/` are handled by the same process.

Because the SPA and the API share an origin, CORS is automatically
skipped (see `server.ts`) and the OAuth callback URLs registered with
each provider (`https://app.hypnosleep.app/api/auth/<provider>/callback`)
point at this service directly.

Attach these Railway services and wire them via env vars:

| Railway service | Env var consumed by the API |
| --- | --- |
| PostgreSQL plugin | `DATABASE_URL` |
| MySQL plugin | `MYSQL_URL` |
| Redis plugin | `REDIS_URL` (optional — rate-limit + audio worker degrade gracefully without it) |
| S3-compatible bucket (e.g. Cloudflare R2, AWS S3) | `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE` |

Other required env vars:

- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `FRONTEND_URL=https://app.hypnosleep.app`
- `API_URL=https://app.hypnosleep.app` (same origin as the SPA)
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`

`STATIC_DIR` and `PORT` are set by the Dockerfile and by Railway
respectively and do not need to be configured manually. Point
Railway's custom domain `app.hypnosleep.app` at this service.

## Authentication — OAuth only

Authentication is **passwordless**. Users log in exclusively via Google,
GitHub, or Microsoft OAuth. The API issues a JWT on successful login
which the frontend stores in `localStorage` and sends as
`Authorization: Bearer <token>` on every subsequent request.

Relevant env vars (all required for auth to boot):

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs all issued JWTs. Rotate with care — rotation invalidates live tokens. |
| `JWT_EXPIRES_IN` | Token lifetime (default `30d`). Any `jsonwebtoken`-compatible string. |
| `FRONTEND_URL` | Where the callback redirects to after login (e.g. `https://app.hypnosleep.app`). |
| `API_URL` | Public URL of the API (e.g. `https://api.hypnosleep.app`). Used to build provider callback URLs. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth credentials. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Microsoft (Entra) OAuth credentials. |
| `MICROSOFT_TENANT_ID` | `common` (default), `consumers`, `organizations`, or a specific tenant GUID. |

### Callback URLs to register with each provider

All callbacks are `GET` endpoints under `/api/auth/<provider>/callback`:

- Google: `${API_URL}/api/auth/google/callback`
- GitHub: `${API_URL}/api/auth/github/callback`
- Microsoft: `${API_URL}/api/auth/microsoft/callback`

### Google

1. Go to <https://console.cloud.google.com/apis/credentials>.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Add your `API_URL` origin under **Authorized JavaScript origins**.
4. Add `${API_URL}/api/auth/google/callback` under
   **Authorized redirect URIs**.
5. Enable the **Google People API** (or at least leave the default OAuth
   consent scopes `profile` and `email` granted — that is all we request).
6. Copy the client ID and secret into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`.

### GitHub

1. Go to <https://github.com/settings/developers> → **OAuth Apps** →
   **New OAuth App**.
2. **Homepage URL**: `FRONTEND_URL`.
3. **Authorization callback URL**:
   `${API_URL}/api/auth/github/callback`.
4. After creation, generate a **Client secret**.
5. Copy the client ID and secret into `GITHUB_CLIENT_ID` /
   `GITHUB_CLIENT_SECRET`.
6. The strategy requests the `user:email` scope so it can read the
   primary email even when it is set to private.

### Microsoft (Entra / Azure AD)

1. Go to <https://entra.microsoft.com> → **App registrations** → **New
   registration**.
2. Pick **Accounts in any organizational directory and personal
   Microsoft accounts** if you want the widest audience (this matches
   the default `MICROSOFT_TENANT_ID=common`).
3. **Redirect URI** (Web): `${API_URL}/api/auth/microsoft/callback`.
4. Under **Certificates & secrets**, create a new **Client secret** and
   copy its *Value* (not the ID) immediately.
5. Under **API permissions**, keep / add **Microsoft Graph → User.Read**
   (delegated). No admin consent is required.
6. Copy the **Application (client) ID** and the secret into
   `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`, and — if you are
   restricting the login to a specific tenant — put that tenant's GUID
   in `MICROSOFT_TENANT_ID`.

### Flow reference

```
Frontend (app.hypnosleep.app)
   ↓ user clicks "Continue with Google"
   ↓ redirect to ${API_URL}/api/auth/google
Backend
   ↓ redirect to Google OAuth consent
Google
   ↓ redirect back to ${API_URL}/api/auth/google/callback?code=...
Backend
   ↓ exchange code → profile
   ↓ upsert user in MySQL (also tracks `signup` event in Postgres)
   ↓ sign JWT (HS256, `JWT_EXPIRES_IN` lifetime)
   ↓ redirect to ${FRONTEND_URL}/auth/callback?token=<jwt>
Frontend
   ↓ stores token in localStorage
   ↓ GET /api/auth/me → user profile
   ↓ redirects to /home (or /onboarding for first-time users)
```

Referral codes are carried through the OAuth round-trip via the
`?ref=<CODE>` query string on the initiation URL; the backend packs the
code into the OAuth `state` parameter and applies it on the callback
(setting `users.referred_by`). Referral *rewards* are handled by the
subscription module, not here.

### Debugging "Sign-in failed — provider_error"

When the error page shows `reason=provider_error`, the token-exchange
step failed **after** the user returned from the provider. In order
of likelihood:

1. **Wrong client secret** in the deployment env vars. The provider
   rejects the token-exchange POST with
   `{"error":"invalid_client"}` → this is the single most common
   cause after a console rotation.
2. **Wrong client ID** — if the ID doesn't belong to the same OAuth
   app as the registered redirect URI, the provider returns
   `invalid_client` as well.
3. **Redirect URI drift** between what we use at authorize time vs.
   token time — very rare, but worth a glance if `API_URL` was
   changed after the provider console entries.
4. **User cancelled** on the consent screen → provider returns
   `access_denied`.

#### Fast path — check the suspected cause in <2 minutes

- `GET /api/health/oauth-callbacks` — unauthenticated. Returns the
  exact callback URLs this deployment builds from `API_URL`. Compare
  them character-for-character against what's registered in:
  - Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
    → **Authorized redirect URIs**
  - GitHub → Developer settings → OAuth Apps → your app →
    **Authorization callback URL**
  - Microsoft Entra → App registrations → your app → Authentication →
    **Redirect URIs** (Web)
- `railway logs` — the startup banner flags obvious placeholder
  values in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc. with the
  message "OAuth credential sanity check flagged one or more
  provider env vars". The values themselves are never logged.
- The user on the error page copies the **support reference** (a
  UUID). Admin users can look it up via
  `GET /api/admin/debug/rid/:rid` — the response's `context` field
  now carries `oauthErrorField` (e.g. `invalid_client`) and
  `oauthErrorDescription` directly from the provider, which narrows
  the cause to exactly one of the four above.

## Scripts

```bash
npm run dev        # tsx watch
npm run build      # tsc -b
npm run test       # vitest run
npm run lint       # eslint src/
```
