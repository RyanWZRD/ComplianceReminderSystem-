# Auth Shell

Authentication modes are configured in `js/auth/config.js`. **App code must import only `js/auth/session.js`** — never `js/auth/supabase-auth.js` (internal).

## Config

```javascript
export const AUTH_MODE = "local"; // local | supabase-preview | supabase
```

| Mode | Behaviour |
|------|-----------|
| `local` | Mock session: Local User, admin (default) |
| `supabase-preview` | Mock session: Preview User, admin (legacy placeholder) |
| `supabase` | Supabase Auth + `public.profiles` row (not wired in `app.js` until a later step) |

In Node, set `process.env.AUTH_MODE=supabase` before importing `session.js` (used by `npm run verify-supabase-auth`). The browser bundle keeps `local` unless `config.js` is changed for dev.

## Session API (`js/auth/session.js`)

- `initAuth()` — initialise session; supabase mode registers auth listener and restores session asynchronously
- `waitForAuthReady()` — resolves after first session restore attempt (supabase mode)
- `getCurrentUser()` — `{ userId, displayName, role, organisationId? }`
- `getOrganisationId()` — organisation UUID in supabase mode, else `null`
- `signInWithPassword(email, password)` — supabase mode only
- `signOut()` — supabase mode only
- `isAuthenticated()`, `getCurrentUserRole()`
- `canView()` / `canEdit()` / `canAdmin()`
- `renderHeaderUserBadge()`

Role checks use `profiles.role` when signed in via supabase mode.

## History

New history entries include optional:

- `userId`
- `userDisplayName`

Older entries without these fields still render normally.

## Phase 2 Step 2 verify

```bash
npm run sync-env
npm run verify-supabase-auth
```

Requires `.env` test user credentials (see `.env.example`). Uses staging alpha users from `docs/cloud-setup.md`.
