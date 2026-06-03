# Compliance Reminder System

A local-first web app to track safeguarding compliance, training renewals, and DBS expiry dates.

## How to run

**Option A — open directly (recommended)**

1. Open `index.html` in your browser (double-click or drag into a browser window).
2. The app loads `app.bundle.js`, which bundles all JavaScript into one file so it works without a web server.

**Option B — local web server**

```powershell
.\serve.ps1
```

Or:

```powershell
npm run serve
```

Then open [http://127.0.0.1:8877](http://127.0.0.1:8877) (serves on port **8877**, bound to loopback).

Equivalent manual command:

```powershell
python -m http.server 8877 --bind 127.0.0.1
```

## After editing source code

The browser loads **`app.bundle.js`**, not `app.js` directly. Rebuild after changes:

```powershell
npm run build
```

## Local mode (default)

Committed defaults: **`DATA_BACKEND=local`**, **`CLOUD_WRITES_ENABLED=false`**. All CRUD uses `savePeople()` / localStorage. No Supabase required.

## Cloud mode (v3.0.0-rc1)

Cloud **load** and **limited RPC writes** are available for staging/alpha. Defaults remain safe (local backend, cloud read-only).

| Mode | URL / config |
|------|----------------|
| Cloud read-only | `?backend=cloud` |
| Cloud RPC writes (dev/staging hosts only) | `?backend=cloud&cloudWrites=1` |

**Supported in cloud (when writes enabled):** mark sent, renew, add/edit record, workspace notes, reminder settings (admin), full action lifecycle, evidence metadata CRUD, single-record archive/delete.

**Out of scope:** file upload/Storage, bulk archive/delete, restore/unarchive, backup/CSV import to cloud, direct table writes.

Setup: `docs/cloud-setup.md`. Release verification: `docs/v3-release-checklist.md`, `docs/cloud-phase3-completion.md`.

```powershell
# Copy .env.example → .env, configure staging, then:
npm run sync-env
npm run build
npm run serve
# Release gate (staging Supabase + migrations through 20260203000016):
npm run verify:phase2
```

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Visual styling |
| `app.js` | Source (ES modules) |
| `app.bundle.js` | Bundled script loaded by the browser |
| `js/data/` | Data layer (local + cloud load + RPC writes) |
| `js/app/permissions.js` | Cloud write gates (`canMutateData()` false in cloud) |
| `js/auth/` | Auth shell (`session.js` facade) |
| `docs/cloud-setup.md` | Supabase setup and migration index |
| `docs/v3-release-checklist.md` | Pre-tag RC checklist |

## Troubleshooting

- **Buttons do nothing** — Hard refresh (`Ctrl+Shift+R`). If you edited `app.js`, run `npm run build`.
- **Red “app did not start” banner** — Check the browser console (F12) for errors.
- **Empty data** — Use **Import CSV** or **Import Backup**, or **Reset sample data** (local mode).
- **Cloud writes disabled** — Add `&cloudWrites=1` on localhost or a configured staging hostname only.
