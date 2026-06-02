# Cloud read-only QA checklist

Use after Phase 2 Step 5+ (login + read-only guards). Sign-off before enabling cloud writes (future step).

**Baseline tag:** `v3.0.0-alpha-phase2-step5.1` or later  
**Staging:** see `docs/staging-deployment.md`

## Automated prerequisites

```powershell
npm run sync-env
npm run verify-staging-config
npm run verify-supabase
npm run verify-supabase-auth
npm run verify-cloud-load
npm run verify-cloud-role-load
npm run verify-repository-cloud
npm run verify-local-mode
npm run verify-read-only-guards
npm run build
```

## Test accounts

| Role | Email (seed docs) |
|------|-------------------|
| admin | `alpha-admin@example.com` |
| editor | `alpha-editor@example.com` |
| viewer | `alpha-viewer@example.com` |

Use staging passwords from `.env` only — never commit them.

---

## A. Local server smoke

Run `npm run serve`, then:

| # | Check | Pass |
|---|--------|:----:|
| A1 | `http://127.0.0.1:8877/` — app loads, **Local User**, table populated | ☐ |
| A2 | `document.documentElement.dataset.appReady === "true"` (F12 console) | ☐ |
| A3 | Add/edit/delete works (local mutability) | ☐ |
| A4 | `http://127.0.0.1:8877/?backend=cloud` — sign-in screen (not blank) | ☐ |
| A5 | After admin sign-in — register loads, read-only banner visible | ☐ |
| A6 | Sign out — returns to sign-in | ☐ |

---

## B. Read-only behaviour (each role)

Repeat B1–B8 as **admin**, **editor**, and **viewer** at `?backend=cloud`.

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| B1 | Sign-in succeeds | ☐ | ☐ | ☐ |
| B2 | Header shows correct display name and role | ☐ | ☐ | ☐ |
| B3 | Summary cards and table show seed data (5 people / 6 records) | ☐ | ☐ | ☐ |
| B4 | **Add person** / edit / delete / renew blocked (message or no effect) | ☐ | ☐ | ☐ |
| B5 | Reminder settings checkboxes disabled or blocked | ☐ | ☐ | ☐ |
| B6 | Import backup / CSV import blocked | ☐ | ☐ | ☐ |
| B7 | **Export CSV**, reports, print still work | ☐ | ☐ | ☐ |
| B8 | Hard refresh — session restores or prompts sign-in cleanly | ☐ | ☐ | ☐ |

---

## C. Boot and error UX

| # | Check | Pass |
|---|--------|:----:|
| C1 | Waiting at login does **not** show false “app did not start” (appState=login) | ☐ |
| C2 | Invalid password shows error on login form | ☐ |
| C3 | Boot failure shows `#app-boot-error` above main app (visible, not blank page) | ☐ |

---

## D. Staging host (if deployed)

| # | Check | Pass |
|---|--------|:----:|
| D1 | Staging URL loads over HTTPS | ☐ |
| D2 | `?backend=cloud` sign-in works on staging origin | ☐ |
| D3 | B-section completed on staging for all three roles | ☐ |

---

## F. Limited writes — Mark Reminder Sent (Step 7)

Requires migration `20260203000001` and `?backend=cloud&cloudWrites=1` on **localhost or staging only** (never production).

| # | Check | Editor | Viewer |
|---|--------|:------:|:------:|
| F1 | Banner shows limited writes / view only | ☐ | ☐ |
| F2 | Mark Sent on Action Required row — success, persists after refresh | ☐ | N/A |
| F3 | Second click — already recorded message | ☐ | N/A |
| F4 | Bulk mark button stays disabled | ☐ | ☐ |
| F5 | Add/edit/renew still blocked | ☐ | ☐ |
| F6 | Viewer: Mark Sent disabled | N/A | ☐ |
| F7 | `?backend=cloud` without `cloudWrites` — Step 6 read-only (B-section) | ☐ | ☐ |

---

## G. Limited writes — Action status (Step 8)

Requires migration `20260203000002` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Editor | Viewer |
|---|--------|:------:|:------:|
| G1 | Banner mentions action complete/reopen | ☐ | ☐ |
| G2 | Open action — Mark complete succeeds, persists after refresh | ☐ | N/A |
| G3 | Completed action — Reopen succeeds, persists after refresh | ☐ | N/A |
| G4 | In-progress action — no status buttons | ☐ | ☐ |
| G5 | Edit / delete action buttons hidden | ☐ | ☐ |
| G6 | Add default actions still blocked | ☐ | ☐ |
| G7 | Viewer: no complete/reopen buttons | N/A | ☐ |
| G8 | Mark Sent (Step 7) still works | ☐ | N/A |

---

## H. Limited writes — Renew compliance (Step 9)

Requires migration `20260203000003` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Editor | Viewer |
|---|--------|:------:|:------:|
| H1 | Banner mentions renew compliance | ☐ | ☐ |
| H2 | Renew expired record (custom date, today or later) — success, persists after refresh | ☐ | N/A |
| H3 | Suggested date on `3-years` record — success | ☐ | N/A |
| H4 | Manual cycle — suggested hidden; custom works | ☐ | N/A |
| H5 | Custom date before today — error message | ☐ | N/A |
| H6 | Edit / add / import still blocked | ☐ | ☐ |
| H7 | Mark Sent + action complete/reopen still work | ☐ | N/A |
| H8 | Viewer: Renew disabled | N/A | ☐ |

---

## E. RLS (database — optional manual)

Postgres write policies are validated in `docs/cloud-phase1-rls-checklist.md` (SQL Editor). No app write tests in Step 6.

| # | Check | Pass |
|---|--------|:----:|
| E1 | Phase 1 RLS checklist §4–5 signed off for staging | ☐ |

---

## Sign-off

| Item | Status |
|------|--------|
| All automated verify scripts pass | ☐ |
| Sections A–C pass (local) | ☐ |
| Section D pass (if staging deployed) | ☐ |
| Cloud remains read-only (`canMutateData()` false) | ☐ |

Date: _______________  
Validated by: _______________
