# Auth Shell (v2.5.0)

Authentication is prepared but **not connected to Supabase yet**.

## Config

`js/auth/config.js`:

```javascript
export const AUTH_MODE = "local"; // or "supabase-preview"
```

| Mode | Behaviour |
|------|-----------|
| `local` | Mock session: Local User, admin |
| `supabase-preview` | Mock session: Preview User, admin (placeholder until Supabase Auth) |

## Session API

`js/auth/session.js`:

- `initAuth()` — initialise session and header badge
- `getCurrentUser()` — `{ userId, displayName, role }`
- `isAuthenticated()`
- `getCurrentUserRole()`
- `canView()` — admin, editor, viewer
- `canEdit()` — admin, editor
- `canAdmin()` — admin only

Role checks are **stubs**; no features are restricted in v2.5.0.

## History

New history entries include optional:

- `userId`
- `userDisplayName`

Older entries without these fields still render normally.

## Supabase later

Replace `resolveSessionUser()` in `session.js` with Supabase Auth session lookup when `AUTH_MODE === "supabase-preview"` (or a dedicated `supabase` mode).
