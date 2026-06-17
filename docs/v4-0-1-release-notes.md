# v4.0.1 release notes and checklist

**Release:** v4.0.1 — Compliance Insights GA hardening  
**Base:** v4.0.0-rc1 (Compliance Insights release candidate)  
**Date:** June 2026  
**Scope:** RC hardening only — bug fixes, terminology, UX clarity, and verification. No new features, CRUD surfaces, cloud/RPC/migration/permission changes beyond RC-001 migration `20260203000017`.

---

## Summary

v4.0.1 completes V4 RC hardening (RC-001 through RC-010). It ships the read-only **Compliance Insights** layer from v4.0.0-rc1 with verified cloud workflow fixes and consistent register/insights terminology. Application behaviour for local mode and cloud defaults is unchanged except where an RC item explicitly fixed a defect.

**Documentation-only slice:** RC-010 — this release checklist and roadmap summary.

---

## Fixes included

| ID | Area | Fix |
|----|------|-----|
| **RC-001** | Cloud actions | **Mark complete from in-progress** — `set_action_status` RPC (migration `20260203000017`) allows `in_progress → completed`; shared `isAllowedActionStatusTransition` rules keep local and cloud parity. |
| **RC-002** | Cloud reminders | **Bulk mark reminders** — toolbar bulk Mark Sent loops `mark_reminder_sent` per eligible record; static wiring and cloud smoke verified. |
| **RC-003** | Register export | **Filtered register CSV export** — Export CSV respects active search, status, type, and expiry filters (not full dataset when filters applied). |
| **RC-004** | Terminology | **Consistency pass** — Compliance Register, Expiring Soon, Valid, Compliance Type, Archive Record (not Delete/People/Due Soon/Compliant). |
| **RC-005** | Compliance Insights | **Stale evidence label clarity** — Key Risks **Any stale evidence** vs Evidence Gaps **Stale evidence only**; drilldown titles, helper text, recommendations, and CSV export aligned. |
| **RC-006** | UI messages | **Error and warning styling** — distinct `.message-success`, `.message-error`, `.message-warning`, `.message-info` colours in `styles.css`. |
| **RC-007** | Register counts | **Count scope clarity** — all-records vs filtered-view hints on summary cards, analytics, and register strip; pagination uses “matching records”. |
| **RC-008** | Renewals | **Renew workflow wording** — Renew Compliance, Renewal Date, New Expiry Date, Renewal completed toasts and history display. |
| **RC-009** | Cloud evidence | **Metadata-only clarity** — evidence file input hidden in cloud; helper: “Cloud mode stores evidence metadata only. File upload is not available in this version.” |
| **RC-010** | Release | **Final hardening summary** — this document and ROADMAP.md RC hardening close-out. |

### Database (RC-001 only)

Staging must include migration **`20260203000017_set_action_status_in_progress_complete.sql`** before `verify:phase2` cloud action smokes.

```powershell
npx supabase migration list
supabase db push
```

---

## Verification commands (required before tagging)

Run from repository root. Both gates must pass.

### 1. Compliance Insights release chain (no Supabase required)

```powershell
npm run verify-insights-release
```

Runs in order:

- `verify-insights-engine`
- `verify-insights-browser`
- `build`
- `verify-terminology-rc004` through `verify-terminology-rc009`

### 2. Cloud release gate (requires `.env` + staging Supabase)

```powershell
npm run verify:phase2
```

Includes RC hardening smokes:

- `verify-action-status-transitions` (RC-001)
- `verify-bulk-mark-reminders` (RC-002)
- `verify-register-csv-export` (RC-003)
- `verify-terminology-rc004`, `rc006`–`rc009` (RC-004, RC-006–RC-009)

Also runs sync-env, staging config, read-only guards, local mode, pre/post staging reset, all Phase 2 + Phase 3 cloud RPC smokes, insights engine, and build.

### Optional standalone debug scripts

| Script | RC |
|--------|-----|
| `npm run verify-action-status-transitions` | RC-001 |
| `npm run verify-bulk-mark-reminders` | RC-002 |
| `npm run verify-register-csv-export` | RC-003 |
| `npm run verify-terminology-rc004` … `rc009` | RC-004–RC-009 |

---

## Manual browser checklist

Automated gates do not replace browser sign-off. Complete before tagging:

**[`docs/v4-rc-browser-acceptance.md`](v4-rc-browser-acceptance.md)** — sections 1–11 (launch, cloud login, roles, CRUD, reminders, actions, evidence, archive, Compliance Insights, exports, narrow screen).

Prerequisites:

```powershell
npm run build
npm run serve
```

Pay extra attention to RC-touched areas:

| Section | RC checks |
|---------|-----------|
| 5 Reminders / renewals | RC-002 bulk Mark Sent; RC-008 Renew Compliance copy |
| 6 Actions | RC-001 Mark complete from in-progress (cloud `cloudWrites=1`) |
| 7 Evidence | RC-009 metadata-only notice in cloud |
| 9 Compliance Insights | RC-005 stale evidence tile labels and helpers |
| 10 Exports | RC-003 filtered register CSV |

Record defects with the bug template in the browser checklist. No open **Critical** or **High** bugs (or documented waivers) before GA tag.

---

## Known non-blocking warnings

These are expected and do not block v4.0.1 tagging:

| Warning | Notes |
|---------|--------|
| **Backup version mismatch** | Importing a backup from an older `appVersion` shows a non-blocking note; import still proceeds. |
| **v2.9.0 QA “PASS with warnings”** | Historical chart/snapshot QA status in ROADMAP; unrelated to V4 gates. |
| **Cloud metadata-only evidence** | File upload unavailable by design (RC-009 documents; not a defect). |
| **Out-of-scope cloud gaps** | Storage uploads, backup/CSV import to cloud, restore/unarchive, bulk archive/delete remain unavailable (v3.1.0 follow-on). |
| **Staging-only cloud writes** | `CLOUD_WRITES_ENABLED` defaults `false`; writes only via `?cloudWrites=1` on allowed hosts. |
| **Service role in `.env`** | Required for Node reset scripts only; never bundled to browser. |

---

## Environment and config

- [ ] `.env` from `.env.example` (never commit `.env`)
- [ ] `SUPABASE_URL` / `SUPABASE_ANON_KEY` point at **staging**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for reset scripts only
- [ ] `npm run sync-env` — `js/data/supabase-env.js` generated
- [ ] Committed defaults unchanged: `DATA_BACKEND=local`, `CLOUD_WRITES_ENABLED=false` in `js/data/config.js`
- [ ] Staging migrations through **`20260203000017`** applied

Canonical staging counts after reset:

| Entity | Count |
|--------|------:|
| People | 5 |
| Compliance records | 6 |
| History entries | 2 |
| Evidence items | 2 |
| Actions | 3 |
| Deleted record snapshots | 1 |

---

## Deployment and tagging steps

### Pre-tag

```powershell
git status
npm run verify-insights-release
npm run verify:phase2
```

Complete manual browser checklist sign-off.

### Version strings (at tag time)

When cutting **v4.0.1**, update and keep in sync:

- `js/data/config.js` — `APP_VERSION`
- `index.html` — `<title>`, version badge, cache-bust query strings
- `npm run build` — rebuild `app.bundle.js`

RC-010 is documentation-only; version bump is a separate chore at tag time.

### Tag and push

```powershell
git add -A
git commit -m "chore: v4.0.1 Compliance Insights GA hardening and release gate"
git tag -a v4.0.1 -m "v4.0.1 — Compliance Insights GA (RC hardening complete)"
git push origin HEAD
git push origin v4.0.1
```

### Static deploy

Redeploy: `index.html`, `app.bundle.js`, `styles.css`, `js/data/supabase-env.js` (if cloud). See [`docs/staging-deployment.md`](staging-deployment.md).

Do not point production safeguarding data at staging until operational/GDPR sign-off.

---

## Constraints (unchanged from V4 RC)

- No new CRUD surfaces beyond RC defect fixes
- No AI/LLM dependency
- Compliance Insights remain read-only (no RPC writes from insights UI)
- RPC-only cloud writes when explicitly enabled

---

## Related documentation

- [`docs/compliance-insights.md`](compliance-insights.md) — Insights sections, metrics, exports
- [`docs/v4-rc-browser-acceptance.md`](v4-rc-browser-acceptance.md) — Manual browser checklist
- [`docs/v3-release-checklist.md`](v3-release-checklist.md) — v3 cloud gate reference
- [`ROADMAP.md`](../ROADMAP.md) — v4.0.1 RC hardening summary

---

## Sign-off

| Item | Status |
|------|--------|
| `npm run verify-insights-release` pass recorded | ☐ |
| `npm run verify:phase2` pass recorded | ☐ |
| Manual browser checklist (sections 1–11) | ☐ |
| Migration `20260203000017` on staging | ☐ |
| No open Critical / High bugs (or waivers) | ☐ |
| Version strings updated for v4.0.1 (at tag) | ☐ |

Date: _______________  
Validated by: _______________
