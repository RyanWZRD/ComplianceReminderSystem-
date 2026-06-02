# Staging deployment (read-only cloud alpha)

Deploy the static app against the **staging** Supabase project. Cloud mode remains **read-only**; `DATA_BACKEND` stays `local` in committed source.

## Prerequisites

- Staging Supabase project linked and migrated (`npm run` docs in `docs/cloud-setup.md`)
- Seed applied and three alpha test users + `profiles` rows (`docs/cloud-setup.md`)
- `.env` with staging `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and test passwords
- `npm run sync-env` (generates gitignored `js/data/supabase-env.js`)

## 1. Pre-deploy checks

From the repository root:

```powershell
npm run sync-env
npm run verify-staging-config
npm run verify-cloud-role-load
npm run verify-read-only-guards
npm run build
```

## 2. Build artifact

The browser needs these files (same directory):

| File | Notes |
|------|--------|
| `index.html` | Entry page |
| `app.bundle.js` | Run `npm run build` after any `app.js` change |
| `styles.css` | Styles |
| `js/data/supabase-env.js` | **Generated** — include in deploy bundle or regenerate in CI |

Never commit `.env` or real keys. The anon key in `supabase-env.js` is expected in a SPA; enforcement is RLS.

## 3. Choose a static host

Examples:

- **GitHub Pages** — publish repo root or `docs/` artifact folder
- **Netlify / Cloudflare Pages** — drag-and-drop or connect repo
- **Internal static host** — copy files to a web root

Record your **staging origin**, e.g. `https://your-org.github.io/ComplianceReminderSystem-/`.

## 4. Supabase Auth URL configuration

In the staging project **Authentication → URL configuration**:

| Setting | Value |
|---------|--------|
| Site URL | Your staging origin (or local dev `http://127.0.0.1:8877`) |
| Redirect URLs | Staging origin, `http://127.0.0.1:8877`, `http://127.0.0.1:8877/?backend=cloud` |

Local CLI `supabase/config.toml` uses `http://127.0.0.1:8877` for `supabase start` auth. Update dashboard URLs when the staging hostname changes.

## 5. Deploy steps

1. `npm run sync-env` (staging `.env`)
2. `npm run build`
3. Upload `index.html`, `app.bundle.js`, `styles.css`, and `js/data/supabase-env.js` to the host
4. Confirm the site loads over **HTTPS** (recommended for production-like staging)

## 6. Smoke URLs

| Mode | URL |
|------|-----|
| Local static server | `http://127.0.0.1:8877/` |
| Local cloud (read-only) | `http://127.0.0.1:8877/?backend=cloud` |
| Staging cloud (read-only) | `https://YOUR_STAGING_ORIGIN/?backend=cloud` |

`?backend=cloud` selects cloud data + Supabase auth without changing the committed default `DATA_BACKEND = "local"`.

## 7. Post-deploy QA

Complete `docs/cloud-readonly-qa.md` on the staging URL for **admin**, **editor**, and **viewer** accounts.

## Rollback

- Re-deploy the previous static file set or revert the hosting release
- Revert Supabase Auth URL changes in the dashboard if needed
- Application code rollback: checkout tag `v3.0.0-alpha-phase2-step5.1` and rebuild

No database rollback is required for a static-only deploy.
