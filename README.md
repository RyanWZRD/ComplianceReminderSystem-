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

Then open [http://localhost:8765](http://localhost:8765).

## After editing source code

The browser loads **`app.bundle.js`**, not `app.js` directly. Rebuild after changes:

```powershell
npm run build
```

## Key files

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Visual styling |
| `app.js` | Source (ES modules) |
| `app.bundle.js` | Bundled script loaded by the browser |
| `js/data/` | Data layer (localStorage repository) |
| `js/auth/` | Auth shell (mock session) |

## Troubleshooting

- **Buttons do nothing** — Hard refresh (`Ctrl+Shift+R`). If you edited `app.js`, run `npm run build`.
- **Red “app did not start” banner** — Check the browser console (F12) for errors.
- **Empty data** — Use **Import CSV** or **Import Backup**, or **Reset sample data**.
