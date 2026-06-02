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
| `supabase` | Supabase Auth + `public.profiles` row |

Browser cloud dev: add `?backend=cloud` to the URL (auto-sets auth to `supabase`). Login UI is shown before the register loads.

In Node, set `process.env.AUTH_MODE=supabase` before importing `session.js` (used by verify scripts). Committed defaults remain `local` / `local`.

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

## Phase 2 Step 6 — Read-only cloud QA

All signed-in roles (admin, editor, viewer) can **load** the same organisation data. The app blocks **mutations** in cloud mode until a future write step (`canMutateData()` is false for all cloud users).

```bash
npm run verify-cloud-role-load
```

Manual browser checklist: `docs/cloud-readonly-qa.md`. Staging deploy: `docs/staging-deployment.md`.
