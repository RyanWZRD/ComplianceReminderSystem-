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

## Cloud mode (read-only alpha)

Default build is **local**. To test cloud against staging Supabase:

1. Copy `.env.example` → `.env`, configure staging URL/keys and test users (`docs/cloud-setup.md`).
2. `npm run sync-env` then `npm run build` and `npm run serve`.
3. Open [http://127.0.0.1:8877/?backend=cloud](http://127.0.0.1:8877/?backend=cloud) and sign in.

Staging deployment and QA: `docs/staging-deployment.md`, `docs/cloud-readonly-qa.md`.

Verify: `npm run verify-cloud-role-load` (admin / editor / viewer load parity).

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Visual styling |
| `app.js` | Source (ES modules) |
| `app.bundle.js` | Bundled script loaded by the browser |
| `js/data/` | Data layer (local + cloud load) |
| `js/auth/` | Auth shell (`session.js` facade) |
| `docs/cloud-setup.md` | Supabase setup and Phase 2 steps |

## Troubleshooting

- **Buttons do nothing** — Hard refresh (`Ctrl+Shift+R`). If you edited `app.js`, run `npm run build`.
- **Red “app did not start” banner** — Check the browser console (F12) for errors.
- **Empty data** — Use **Import CSV** or **Import Backup**, or **Reset sample data**.
