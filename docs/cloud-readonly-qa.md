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
