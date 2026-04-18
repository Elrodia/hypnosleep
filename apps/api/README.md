# HypnoSleep API

Express + Drizzle backend for HypnoSleep.

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

## Scripts

```bash
npm run dev        # tsx watch
npm run build      # tsc -b
npm run test       # vitest run
npm run lint       # eslint src/
```
