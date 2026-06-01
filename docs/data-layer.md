# Data Layer (v2.4.0)

Persistence is handled through a **repository** instead of direct `localStorage` calls in `app.js`.

## Structure

```
js/data/
  config.js          DATA_BACKEND flag and APP_VERSION
  constants.js       Storage keys, compliance types, history actions
  dates.js           Date parsing and validation helpers
  local-store.js     LocalComplianceStore (localStorage)
  settings-store.js  LocalSettingsStore (reminder settings)
  repository.js      Factory + exported repository singleton
```

## Usage

`app.js` imports `repository` and `settingsRepository`:

- `repository.people`, `repository.nextPersonId`, etc. — in-memory state
- `repository.save()` / `repository.load()` — persist to localStorage
- `repository.buildBackup()` / `repository.applyBackup(data)` — backup import/export
- `repository.validateBackupDryRun(data)` — validate without importing

## Feature flag

In `js/data/config.js`:

```javascript
export const DATA_BACKEND = "local"; // or "cloud" (stub — not implemented)
```

Cloud mode throws until v2.5+ implements Supabase sync.

## v3 migration

Draft PostgreSQL schema: `docs/schema-v3-draft.sql`
