# Data Layer

Persistence is handled through a **repository** instead of direct `localStorage` calls in `app.js`.

## Structure

```
js/data/
  config.js                 DATA_BACKEND, CLOUD_WRITES_ENABLED, APP_VERSION
  reminder-sent.js          Reminder-sent labels and RPC type mapping
  constants.js              Storage keys, compliance types, history actions
  dates.js                  Date parsing and validation helpers
  local-store.js            LocalComplianceStore (localStorage)
  settings-store.js         LocalSettingsStore (reminder settings)
  repository.js             Factory + exported repository singleton
  supabase-env.example.js   Template for Supabase URL and anon key
  supabase-env.js           Gitignored — generated via npm run sync-env
  supabase-client.js        Browser Supabase client
  cloud-mapper.js           Internal Postgres row → nested app shape
  renew-compliance.js       Renewal mode mapping + custom date validation (London today)
  update-compliance-record-notes.js  Notes RPC mapping (cloud workspace save)
  cloud-store.js            CloudComplianceStore (load; RPC writes; save is no-op)
  cloud-settings-store.js   CloudSettingsStore (load-only; setSettings throws)
```

`repository.js` selects local vs cloud from `DATA_BACKEND` (committed default: `local`).

## Usage

`app.js` imports `repository` and `settingsRepository`:

- `repository.people`, `repository.nextPersonId`, etc. — in-memory state
- `repository.save()` / `repository.load()` — persist (localStorage in local mode; no-op save in cloud)
- `repository.buildBackup()` / `repository.applyBackup(data)` — backup import/export (local; cloud throws)
- `repository.validateBackupDryRun(data)` — validate without importing

## Feature flags

In `js/data/config.js`:

```javascript
export const DATA_BACKEND = "local"; // committed default
export const CLOUD_WRITES_ENABLED = false; // committed default
```

Browser cloud dev: `?backend=cloud` in the URL. Browser limited writes: `?cloudWrites=1` on localhost or `STAGING_APP_HOSTNAMES` only.

Node verify scripts: `process.env.DATA_BACKEND=cloud` and per-script `CLOUD_WRITES_ENABLED=true` for RPC tests.

Cloud **load** is implemented. **Mark Reminder Sent**, **renew compliance**, **action complete/reopen**, **add compliance record**, **edit compliance record**, **workspace notes**, and **reminder settings (admin)** use RPC when `CLOUD_WRITES_ENABLED` is true. All other cloud mutations remain blocked (`canMutateData()` false in cloud). See `js/app/permissions.js`.

## Verify scripts

| Script | Purpose |
|--------|---------|
| `npm run verify:phase2` | **Full Phase 2 suite** (all rows below + build) |
| `npm run sync-env` | Generate `supabase-env.js` from `.env` |
| `npm run verify-supabase` | Client configured |
| `npm run verify-supabase-auth` | Sign-in / profile / sign-out |
| `npm run verify-cloud-load` | CloudComplianceStore.load (admin) |
| `npm run verify-cloud-role-load` | Load parity admin / editor / viewer |
| `npm run verify-repository-cloud` | Repository singleton + cloud load |
| `npm run verify-local-mode` | Local works without Supabase |
| `npm run verify-read-only-guards` | `canMutateData()` false; granular writes off without flag |
| `npm run verify-cloud-mark-reminder-sent` | Editor mark-sent RPC + reload; viewer denied |
| `npm run verify-cloud-set-action-status` | Editor action status RPC; viewer denied |
| `npm run verify-cloud-renew-compliance` | Editor renew RPC; viewer denied |
| `npm run verify-cloud-create-compliance-record` | Editor create RPC; viewer denied |
| `npm run verify-cloud-edit-compliance-record` | Editor edit RPC; viewer denied |
| `npm run verify-cloud-update-compliance-record-notes` | Editor notes RPC + reload; viewer denied |
| `npm run verify-cloud-update-reminder-settings` | Admin settings RPC; editor/viewer denied |
| `npm run verify-staging-config` | `.env` + `supabase-env.js` present |

See `docs/cloud-phase2-completion.md`, `docs/cloud-setup.md`, and `docs/staging-deployment.md`.

## v3 migration

PostgreSQL schema: `supabase/migrations/`. Draft reference: `docs/schema-v3-draft.sql` (superseded by migrations).
