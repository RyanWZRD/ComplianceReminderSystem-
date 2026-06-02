# Cloud QA checklist (Phase 2)

Manual sign-off for cloud mode after Phase 2 Step 5+. **Default cloud UX is read-only** (`CLOUD_WRITES_ENABLED` false). Limited RPC writes are tested separately with `?cloudWrites=1` on localhost or staging only.

**Baseline tag:** `v3.0.0-alpha-phase2-step11` or later (Step 12: `v3.0.0-alpha-phase2-step12`)  
**Staging:** `docs/staging-deployment.md`  
**Close-out:** `docs/cloud-phase2-completion.md`

## Automated prerequisites

Run the full suite (recommended):

```powershell
npm run verify:phase2
```

Or run individually:

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
npm run verify-cloud-mark-reminder-sent
npm run verify-cloud-set-action-status
npm run verify-cloud-renew-compliance
npm run verify-cloud-create-compliance-record
npm run verify-cloud-edit-compliance-record
npm run build
```

## Test accounts

| Role | Email (seed docs) |
|------|-------------------|
| admin | `alpha-admin@example.com` |
| editor | `alpha-editor@example.com` |
| viewer | `alpha-viewer@example.com` |

Use staging passwords from `.env` only — never commit them.

**Admin vs editor (cloud writes):** admin has the same `canEdit()`-based RPC permissions as editor for Steps 7–11. Verify admin in F–J alongside editor.

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

Repeat B1–B8 as **admin**, **editor**, and **viewer** at `?backend=cloud` (no `cloudWrites`).

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

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| F1 | Banner shows limited writes / view only | ☐ | ☐ | ☐ |
| F2 | Mark Sent on Action Required row — success, persists after refresh | ☐ | ☐ | N/A |
| F3 | Second click — already recorded message | ☐ | ☐ | N/A |
| F4 | Bulk mark button stays disabled | ☐ | ☐ | ☐ |
| F5 | Add/edit/renew still blocked | ☐ | ☐ | ☐ |
| F6 | Viewer: Mark Sent disabled | N/A | N/A | ☐ |
| F7 | `?backend=cloud` without `cloudWrites` — read-only (B-section) | ☐ | ☐ | ☐ |

---

## G. Limited writes — Action status (Step 8)

Requires migration `20260203000002` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| G1 | Banner mentions action complete/reopen | ☐ | ☐ | ☐ |
| G2 | Open action — Mark complete succeeds, persists after refresh | ☐ | ☐ | N/A |
| G3 | Completed action — Reopen succeeds, persists after refresh | ☐ | ☐ | N/A |
| G4 | In-progress action — no status buttons | ☐ | ☐ | ☐ |
| G5 | Edit / delete action buttons hidden | ☐ | ☐ | ☐ |
| G6 | Add default actions still blocked | ☐ | ☐ | ☐ |
| G7 | Viewer: no complete/reopen buttons | N/A | N/A | ☐ |
| G8 | Mark Sent (Step 7) still works | ☐ | ☐ | N/A |

---

## H. Limited writes — Renew compliance (Step 9)

Requires migration `20260203000003` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| H1 | Banner mentions renew compliance | ☐ | ☐ | ☐ |
| H2 | Renew expired record (custom date, today or later) — success, persists after refresh | ☐ | ☐ | N/A |
| H3 | Suggested date on `3-years` record — success | ☐ | ☐ | N/A |
| H4 | Manual cycle — suggested hidden; custom works | ☐ | ☐ | N/A |
| H5 | Custom date before today — error message | ☐ | ☐ | N/A |
| H6 | Edit / add / import still blocked | ☐ | ☐ | ☐ |
| H7 | Mark Sent + action complete/reopen still work | ☐ | ☐ | N/A |
| H8 | Viewer: Renew disabled | N/A | N/A | ☐ |

---

## I. Limited writes — Create compliance record (Step 10)

Requires migration `20260203000004` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| I1 | Banner mentions add compliance records | ☐ | ☐ | ☐ |
| I2 | Add new person + DBS record — success, persists after refresh | ☐ | ☐ | N/A |
| I3 | Add second record for existing person (name case variant) — one person, two records | ☐ | ☐ | N/A |
| I4 | Blank name — validation error on form | ☐ | ☐ | N/A |
| I5 | Edit / delete / CSV import still blocked | ☐ | ☐ | ☐ |
| I6 | Mark Sent + renew + action complete/reopen still work | ☐ | ☐ | N/A |
| I7 | Viewer: Add Person form disabled | N/A | N/A | ☐ |
| I8 | `?backend=cloud` without `cloudWrites` — add form disabled | ☐ | ☐ | ☐ |

---

## J. Limited writes — Edit compliance record (Step 11)

Requires migration `20260203000005` and `?backend=cloud&cloudWrites=1` on **localhost or staging only**.

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| J1 | Banner mentions edit compliance records | ☐ | ☐ | ☐ |
| J2 | Edit role + compliance type + expiry + cycle — success, persists after refresh | ☐ | ☐ | N/A |
| J3 | Notes field disabled in edit form; existing notes unchanged after save | ☐ | ☐ | N/A |
| J4 | Rename to existing person name — error, no duplicate person | ☐ | ☐ | N/A |
| J5 | No changes submit — appropriate message | ☐ | ☐ | N/A |
| J6 | Delete / CSV / workspace Save Notes still blocked | ☐ | ☐ | ☐ |
| J7 | Mark Sent + renew + add + action complete/reopen still work | ☐ | ☐ | N/A |
| J8 | Viewer: Edit disabled | N/A | N/A | ☐ |
| J9 | `?backend=cloud` without `cloudWrites` — edit form disabled | ☐ | ☐ | ☐ |

---

## K. Integrated limited-writes pass (Step 12)

One editor session at `?backend=cloud&cloudWrites=1`:

| # | Check | Pass |
|---|--------|:----:|
| K1 | Run F→J flows in sequence on test data; hard refresh between steps — data consistent | ☐ |
| K2 | Remove `cloudWrites` from URL (or open `?backend=cloud` only) — forms/buttons read-only after refresh | ☐ |
| K3 | Sign out and sign in as viewer — no write controls enabled | ☐ |
| K4 | Sign in as admin — same write capabilities as editor for operational RPCs | ☐ |

---

## E. RLS (database — optional manual)

Postgres write policies are validated in `docs/cloud-phase1-rls-checklist.md` (SQL Editor).

| # | Check | Pass |
|---|--------|:----:|
| E1 | Phase 1 RLS checklist §4–5 signed off for staging | ☐ |

---

## Sign-off

| Item | Status |
|------|--------|
| `npm run verify:phase2` passes | ☐ |
| Sections A–C pass (local) | ☐ |
| Section B pass (cloud read-only, all roles) | ☐ |
| Sections F–J pass (editor + viewer; admin mirrors editor) | ☐ |
| Section K pass | ☐ |
| Section D pass (if staging deployed) | ☐ |
| `canMutateData()` false in cloud even when `cloudWrites=1` | ☐ |
| Phase 3 items remain blocked (notes, evidence, delete, import, settings) | ☐ |

Date: _______________  
Validated by: _______________
