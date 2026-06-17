# v4.0.0-rc1 browser acceptance checklist

Manual sign-off for **v4.0.0-rc1** during RC hardening. This checklist is documentation only — use it to find and log bugs systematically before GA.

**Scope:** Browser UX and read-only Compliance Insights. No new features, insight calculation changes, CRUD changes (unless fixing a verified bug), or migrations/RPC/permission changes in this phase.

**Related docs:**

- [`docs/compliance-insights.md`](compliance-insights.md) — Insights sections, exports, empty states
- [`docs/cloud-readonly-qa.md`](cloud-readonly-qa.md) — Detailed cloud read/write checks (v3 gate)
- [`docs/v3-release-checklist.md`](v3-release-checklist.md) — Automated release gate

## Prerequisites

```powershell
npm run build
npm run serve
```

| Item | Pass |
|------|:----:|
| `npm run verify-insights-release` passes | ☐ |
| `npm run verify:phase2` passes (requires `.env` + staging Supabase) | ☐ |
| Header shows **v4.0.0-rc1** after load | ☐ |

**Test accounts (cloud):**

| Role | Email |
|------|-------|
| admin | `alpha-admin@example.com` |
| editor | `alpha-editor@example.com` |
| viewer | `alpha-viewer@example.com` |

Use staging passwords from `.env` only — never commit them.

**URLs:**

| Mode | URL |
|------|-----|
| Local | `http://127.0.0.1:8877/` |
| Cloud read-only | `http://127.0.0.1:8877/?backend=cloud` |
| Cloud limited writes | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |

---

## 1. Launch / local load

| # | Check | Pass |
|---|--------|:----:|
| 1.1 | `http://127.0.0.1:8877/` loads without blank page or boot error banner | ☐ |
| 1.2 | Console: `document.documentElement.dataset.appReady === "true"` | ☐ |
| 1.3 | Header shows **Local User** (or configured local session) and role badge | ☐ |
| 1.4 | Register table populated (local seed or saved data) | ☐ |
| 1.5 | Summary / analytics cards render above the table | ☐ |
| 1.6 | **Compliance Insights** section visible on dashboard | ☐ |
| 1.7 | Hard refresh preserves data (localStorage) | ☐ |
| 1.8 | `file://` open via `index.html` + `app.bundle.js` loads (optional smoke) | ☐ |

---

## 2. Cloud login

| # | Check | Pass |
|---|--------|:----:|
| 2.1 | `?backend=cloud` shows sign-in screen (not stuck on loading) | ☐ |
| 2.2 | Invalid password shows error on login form | ☐ |
| 2.3 | Admin sign-in succeeds; register loads | ☐ |
| 2.4 | Header shows correct display name and role after sign-in | ☐ |
| 2.5 | Sign out returns to sign-in cleanly | ☐ |
| 2.6 | Hard refresh restores session or prompts sign-in (no blank state) | ☐ |
| 2.7 | Waiting at login does **not** show false “app did not start” banner | ☐ |

---

## 3. Admin / editor / viewer permissions

Repeat as **admin**, **editor**, and **viewer** at `?backend=cloud` (no `cloudWrites` unless noted).

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| 3.1 | Sign-in succeeds | ☐ | ☐ | ☐ |
| 3.2 | Seed data visible (5 people / 6 records) | ☐ | ☐ | ☐ |
| 3.3 | Read-only banner or equivalent when writes disabled | ☐ | ☐ | ☐ |
| 3.4 | Add / edit / delete record blocked without `cloudWrites=1` | ☐ | ☐ | ☐ |
| 3.5 | Export CSV, reports, and print still work | ☐ | ☐ | ☐ |
| 3.6 | Compliance Insights visible and interactive (tiles, preview) | ☐ | ☐ | ☐ |
| 3.7 | With `cloudWrites=1`: editor/admin can use allowed RPC writes; viewer denied | ☐ | ☐ | ☐ |
| 3.8 | Admin mirrors editor for operational RPC permissions | ☐ | ☐ | N/A |

---

## 4. Compliance records

| # | Check | Local | Cloud (`cloudWrites=1`) |
|---|--------|:-----:|:-------------------------:|
| 4.1 | Register search, filters, sort, and pagination work | ☐ | ☐ |
| 4.2 | Status badges (Valid / Expiring Soon / Expired) correct for known rows | ☐ | ☐ |
| 4.3 | **Details** opens workspace; **Close** / Escape returns to table | ☐ | ☐ |
| 4.4 | Add new person + record succeeds and persists after refresh | ☐ | ☐ |
| 4.5 | Edit record (role, type, expiry, cycle) succeeds and persists | ☐ | ☐ |
| 4.6 | Workspace **Save Notes** works (cloud: editor/admin only) | ☐ | ☐ |
| 4.7 | Edit-form notes disabled in cloud; workspace notes path used | N/A | ☐ |
| 4.8 | Validation errors shown for blank name or invalid dates | ☐ | ☐ |

---

## 5. Reminders / renewals

| # | Check | Local | Cloud (`cloudWrites=1`) |
|---|--------|:-----:|:-------------------------:|
| 5.1 | Action Required table shows records in reminder windows | ☐ | ☐ |
| 5.2 | **Mark Sent** succeeds; note/history updated; persists after refresh | ☐ | ☐ |
| 5.3 | Second Mark Sent shows already-recorded feedback | ☐ | ☐ |
| 5.4 | Reminder settings (30 / 14 / 7 days, hide sent) — admin only in cloud | ☐ | ☐ |
| 5.5 | **Renew** with suggested date succeeds on eligible record | ☐ | ☐ |
| 5.6 | **Renew** with custom date (today or later) succeeds | ☐ | ☐ |
| 5.7 | Renew with past date shows validation error | ☐ | ☐ |
| 5.8 | Viewer: Mark Sent and Renew disabled in cloud | N/A | ☐ |

---

## 6. Actions

| # | Check | Local | Cloud (`cloudWrites=1`) |
|---|--------|:-----:|:-------------------------:|
| 6.1 | Workspace shows action list for record with actions | ☐ | ☐ |
| 6.2 | Add Action succeeds; appears after refresh | ☐ | ☐ |
| 6.3 | Mark complete / Reopen succeeds; persists after refresh | ☐ | ☐ |
| 6.4 | Mark in progress succeeds (editor/admin) | ☐ | ☐ |
| 6.5 | Edit Action (title, notes, due date, owner) succeeds | ☐ | ☐ |
| 6.6 | Delete action succeeds with confirmation | ☐ | ☐ |
| 6.7 | Add default actions (workspace) succeeds | ☐ | ☐ |
| 6.8 | Bulk add action from toolbar succeeds | ☐ | ☐ |
| 6.9 | Viewer: no add/edit/delete/in-progress controls in cloud | N/A | ☐ |

---

## 7. Evidence

| # | Check | Local | Cloud (`cloudWrites=1`) |
|---|--------|:-----:|:-------------------------:|
| 7.1 | Add Evidence (metadata) succeeds in workspace | ☐ | ☐ |
| 7.2 | Edit evidence metadata succeeds | ☐ | ☐ |
| 7.3 | Delete evidence succeeds with confirmation | ☐ | ☐ |
| 7.4 | Cloud: file upload input hidden or blocked (metadata only) | N/A | ☐ |
| 7.5 | Evidence panel expand/collapse works | ☐ | ☐ |
| 7.6 | Viewer: evidence mutate controls hidden in cloud | N/A | ☐ |

---

## 8. Deleted snapshots / archive

| # | Check | Local | Cloud (`cloudWrites=1`) |
|---|--------|:-----:|:-------------------------:|
| 8.1 | Workspace **Delete Record** prompts for confirmation | ☐ | ☐ |
| 8.2 | Delete/archive removes record from active register | ☐ | ☐ |
| 8.3 | Cloud: seed includes 1 deleted snapshot; load does not error | N/A | ☐ |
| 8.4 | Local: deleted snapshot retained in `deletedRecordHistory` (backup export includes it) | ☐ | N/A |
| 8.5 | Restore / unarchive remains unavailable (out of scope) | ☐ | ☐ |
| 8.6 | Bulk archive/delete remains unavailable (out of scope) | ☐ | ☐ |

---

## 9. Compliance Insights

Test in **local** and **cloud** (read-only insights; no RPC).

| # | Check | Pass |
|---|--------|:----:|
| 9.1 | **Health Overview** — composite score, band, and sub-scores render | ☐ |
| 9.2 | **Key Risks** — tiles show counts; click opens drilldown preview | ☐ |
| 9.3 | **Evidence Gaps** — critical / high / stale tiles and drilldowns | ☐ |
| 9.4 | **Renewal Forecast** — window tiles and drilldowns | ☐ |
| 9.5 | **Recommendations** — prioritized list with badges; links to preview | ☐ |
| 9.6 | **Operational Health** — reminder follow-up score and missing-count tile | ☐ |
| 9.7 | Drilldown preview shows title, count, explanation, and table | ☐ |
| 9.8 | **Clear Preview** closes preview panel | ☐ |
| 9.9 | Empty states show green messages when section has zero items | ☐ |
| 9.10 | Register empty state when `recordCount === 0` | ☐ |
| 9.11 | Cloud note about metadata-only evidence visible when applicable | ☐ |
| 9.12 | Insight card clicks still filter register table (legacy behaviour) | ☐ |
| 9.13 | Hard refresh — insights recompute from loaded data without errors | ☐ |

---

## 10. Exports

| # | Check | Pass |
|---|--------|:----:|
| 10.1 | Register **Export CSV** downloads expected columns | ☐ |
| 10.2 | Bulk **Export selected CSV** works when rows selected | ☐ |
| 10.3 | Reports & Audit Pack — preview, Export CSV, Print | ☐ |
| 10.4 | Management Snapshot — Export Snapshot CSV and print | ☐ |
| 10.5 | Compliance Insights — **Export Insights Summary** (`compliance-insights-summary-YYYY-MM-DD.csv`) | ☐ |
| 10.6 | Compliance Insights — **Export Drilldown Preview** when preview open | ☐ |
| 10.7 | Insight preview **Export Insight CSV** (legacy management insights) | ☐ |
| 10.8 | Local JSON backup export and import still work | ☐ |
| 10.9 | Cloud: backup / CSV import blocked | ☐ |

---

## 11. Mobile / narrow screen

Resize browser to ~375px width (or use device toolbar). Repeat critical paths.

| # | Check | Pass |
|---|--------|:----:|
| 11.1 | App loads; header and main content readable (no horizontal overflow on body) | ☐ |
| 11.2 | Summary cards and Compliance Insights sections stack without overlap | ☐ |
| 11.3 | Register table scrolls horizontally or reflows without breaking layout | ☐ |
| 11.4 | Workspace opens and close control reachable | ☐ |
| 11.5 | Modals (add/edit/renew/evidence/action) fit viewport; buttons tappable | ☐ |
| 11.6 | Drilldown preview panel usable on narrow width | ☐ |
| 11.7 | Sign-in form usable on narrow width | ☐ |

---

## Bug capture format

Log each defect found during RC testing using this template. Copy one block per bug.

```markdown
### BUG-___: [Short title]

**Steps to reproduce:**
1.
2.
3.

**Expected:**
[What should happen]

**Actual:**
[What happened]

**Severity:** Critical | High | Medium | Low

**Environment:**
- Mode: local | cloud read-only | cloud writes
- Role: admin | editor | viewer | local user
- Browser:
- URL:
- App version: v4.0.0-rc1

**Screenshot / logs:**
- Screenshot: (attach or path)
- Console errors:
- Network failures:
```

### Severity guide

| Level | When to use |
|-------|-------------|
| **Critical** | Data loss, security/permission bypass, app unusable, crash on load |
| **High** | Core workflow broken (login, CRUD, insights wrong enough to mislead) |
| **Medium** | Workaround exists; UX confusion; non-blocking visual defect |
| **Low** | Cosmetic, typo, minor alignment; edge case with rare data |

---

## Sign-off

| Item | Status |
|------|--------|
| Sections 1–2 pass (launch + login) | ☐ |
| Section 3 pass (all roles) | ☐ |
| Sections 4–8 pass (local + cloud as applicable) | ☐ |
| Section 9 pass (Compliance Insights) | ☐ |
| Section 10 pass (exports) | ☐ |
| Section 11 pass (narrow screen) | ☐ |
| No open Critical / High bugs (or documented waivers) | ☐ |
| `npm run verify-insights-release` pass recorded | ☐ |
| `npm run verify:phase2` pass recorded | ☐ |

Date: _______________  
Validated by: _______________  
Open bugs filed: _______________
