# Compliance Reminder System Roadmap

A local-first safeguarding compliance tracker. Runs in the browser with localStorage by default, or against a shared Supabase cloud backend (v3.0.0+).

---

# Current Release

## v5.0.0-alpha.2 — V5-1A Contact Management + V5-1B Reminder Template Preview

**Date:** June 2026

### Summary

Second v5 alpha checkpoint: **V5-1A** optional person email and manager email (register, CSV, Contact Readiness, drilldown-to-edit) plus **V5-1B** read-only reminder template preview (modal, copy/export, operational preview dashboard). No email delivery, automation, or permission changes.

**Documentation:**

- [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md) — alpha.2 release gate
- [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md) — V5-1A detail
- [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md) — V5-1B Phases 1–5

**Release verification (required before tag):**

- `npm run verify-reminder-suite` — V5-1B reminder preview chain (no Supabase)
- `npm run verify-contact-management` — V5-1A contact CSV/workspace + insights release chain (no Supabase)
- `npm run verify-insights-release` — insights regression subset
- `npm run verify:phase2` — requires `.env` + staging Supabase (includes cloud contact RPC smokes)

Application version: **v5.0.0-alpha.2**

**Next slice:** V5-0 Automation Platform Foundation

Status: Alpha checkpoint complete (V5-1B Phase 5)  
Tag: not created unless explicitly requested

---

## v5.0.0-alpha.1 — V5-1A Contact Management

**Date:** June 2026

First v5 alpha checkpoint: optional person **email** and **manager email** across local/cloud data, add/edit forms, register and CSV, Compliance Insights **Contact Readiness**, and drilldown-to-edit workflow.

**Documentation:** [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md)

Application version: **v5.0.0-alpha.1** (superseded by alpha.2)

---

## V5-1B Phase 1 — Reminder Template Preview Foundation · Complete

**Date:** June 2026

Read-only reminder email template generation (`js/app/reminders/reminder-templates.js`) for 30/14/7-day and expired windows. Uses V5-1A contact emails when present. No sending, queue, or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview`

---

## V5-1B Phase 2 — Reminder Template Preview UI · Complete

**Date:** June 2026

On-screen **Preview Reminder Email** action in Action Required rows and record workspace (when in an active reminder window). Modal shows recipient/manager email, reminder type, subject, body, preview-only disclaimer, and missing-recipient warning. No email sending or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview-ui`

---

## V5-1B Phase 3 — Reminder Preview Copy and Export · Complete

**Date:** June 2026

Preview modal **Copy subject**, **Copy body**, **Copy full email**, and **Export preview text file** actions. Full email text includes To, manager email (when present), reminder type, subject, and body. Clipboard-unavailable fallback message; export always available. No email sending or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview-actions`

---

## V5-1B Phase 4 — Reminder Preview Dashboard · Complete

**Date:** June 2026

Operational **Reminder Preview Dashboard** with card counts (30/14/7-day, expired, total previewable), drilldown table (person, email, compliance type, expiry, reminder type), actions to preview/open workspace/edit contact, and **Export Reminder Pack** (`.txt` of all previews in drilldown). Counts include only qualifying reminders with email on file. No sending, queue, or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-preview-dashboard`

---

## V5-1B Phase 5 — Alpha Release Gate · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v5.0.0-alpha.2**. Combined release notes, `verify-reminder-suite`, version bump, browser acceptance checklist. No application logic changes.

**Documentation:** [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md) · [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-suite` · `npm run verify-contact-management` · `npm run verify-insights-release` · `npm run verify:phase2`

---

## v3.0.0 Released

**Date:** June 2026

### Major achievements

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions
- Compliance CRUD parity
- Verification framework
- First production release

Status: Released  
Tag: v3.0.0

---

# Next Planned Release

## V5-0 — Automation Platform Foundation

Schema, RPC contracts, dry-run scan engine, and feature flags without user-visible automation yet. Prerequisite for V5-1 automated reminders and digests.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) (V5-0 section)

**Prior alpha:** v5.0.0-alpha.2 — V5-1A + V5-1B complete; see [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | `automation_policies` + `automation_runs` tables, `AUTOMATION_ENABLED` | **Complete** |
| 2 | Policy admin RPCs (`get_automation_policies`, `upsert_automation_policy`) | **Complete** |
| 3 | Run read RPCs (`get_automation_runs`, `get_automation_run`) | **Complete** |
| 4 | Run creation RPC (`create_automation_run`) | **Complete** |
| 5 | Dry-run scan engine (`computeAutomationDryRun`) | **Complete** |

**Verification:** `npm run verify-automation-foundation`, `verify-automation-policies`, `verify-automation-runs`, `verify-automation-run-create`, `verify-automation-dry-run`

---

# Future Releases

## v5.0.0 — Automated Compliance Operations · In progress (alpha)

Scheduled compliance operations: reminder delivery, action orchestration, escalations, and operations audit. **V5-1A** shipped as **v5.0.0-alpha.1**; **V5-1B Reminder Template Preview** shipped as **v5.0.0-alpha.2**. See [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md), [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md), and [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md).

**Prerequisites:** v4.0.1 GA + v3.1.0 cloud follow-on.

**Alpha verification:**

- `npm run verify-reminder-suite` — V5-1B release gate (no Supabase)
- `npm run verify-contact-management` — V5-1A release gate (no Supabase)
- `npm run verify:phase2` — cloud regression including contact RPC smokes

**Next slice:** V5-0 Automation Platform Foundation

## v4.0.1 — Compliance Insights GA · RC hardening complete

Read-only compliance insights on the dashboard: health score, risk summary, renewal forecast, and rule-based recommendations. See [`docs/compliance-insights.md`](docs/compliance-insights.md) and [Version Roadmap — v4](#v4--compliance-insights-release-candidate).

Application version: **v5.0.0-alpha.2** in source (V5-1A + V5-1B alpha); v4 GA target **v4.0.1**.

**RC hardening summary (June 2026):**

| ID | Fix |
|----|-----|
| RC-001 | Cloud in-progress action completion (`set_action_status` migration `20260203000017`) |
| RC-002 | Cloud bulk mark reminders |
| RC-003 | Filtered register CSV export |
| RC-004 | Terminology consistency (register, status, archive) |
| RC-005 | Stale evidence insight label clarity |
| RC-006 | Error and warning message styling |
| RC-007 | Register count scope clarity (all-records vs filtered view) |
| RC-008 | Renew workflow wording |
| RC-009 | Cloud evidence metadata-only clarity |
| RC-010 | Final hardening summary and release checklist |

**Release docs:** [`docs/v4-0-1-release-notes.md`](docs/v4-0-1-release-notes.md)  
**Manual browser acceptance:** [`docs/v4-rc-browser-acceptance.md`](docs/v4-rc-browser-acceptance.md) (V4-RC1A)

**Release verification (required before tag):**

- `npm run verify-insights-release` — engine, browser smoke, build, RC-004–RC-009 terminology
- `npm run verify:phase2` — requires `.env` + staging Supabase (includes RC-001–RC-003 cloud smokes)

Recommended tag: **v4.0.1** (GA pending sign-off and version string bump)

## v5.0.0 — Automated Compliance Operations · Planned

Scheduled compliance operations: reminder delivery, action orchestration, escalations, and operations audit. See [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) and [Version Roadmap — v5](#v500--automated-compliance-operations--planned).

**Prerequisites:** v4.0.1 GA + v3.1.0 cloud follow-on.

## v3.1.0 — Cloud platform follow-on · Planned

- Evidence storage buckets and uploads
- CSV/backup import migration path
- Restore/unarchive and bulk archive/delete
- Production cloud-writes policy and GDPR checklist

---

# Recent Releases

## v3.0.0 Released

**Date:** June 2026

### Major achievements

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions
- Compliance CRUD parity
- Verification framework
- First production release

Status: Released  
Tag: v3.0.0

---

## v2.9.0 Released

### Visual Insights & Compliance Charts

- Expiry by Month chart
- Compliance Status Breakdown
- Evidence Coverage chart
- Action Workload chart
- Management Snapshot
- Snapshot CSV export
- Snapshot print support

QA Status: PASS with warnings

Status: Released  
Tag: v2.9.0

---

## v2.7.0 (Released)

### Dashboard & Management Insights

Features:

* Management Insights dashboard
* Total Open Actions card
* Actions Linked to Expired Records card
* Records Missing Evidence card
* Expiring This Month card
* Expiring Next Month card
* Compliance Health Score
* Clickable insight cards
* Insight preview table
* Export Insight CSV
* Clear Preview functionality

Benefits:

* Faster identification of compliance risks
* Improved management oversight
* Better prioritisation of actions and evidence collection
* Simplified reporting and operational monitoring

Status: Released  
Tag: v2.7.0

---

## v2.6.0 (Released)

- Bulk record selection
- Bulk actions
- Bulk reminder management
- Export selected CSV
- Selection state improvements

---

## v2.5.1 (Released)

- `app.bundle.js` for opening `index.html` directly (`file://`) without a web server
- Import/export and backup buttons wired early with safer null checks
- Boot error banner if JavaScript fails to start
- `npm run build` to rebuild the bundle after editing `app.js`

---

## v2.5.0 (Released)

- Authentication shell (local mock session)
- `AUTH_MODE` config (`local` | `supabase-preview`)
- Session helpers and role permission stubs
- History entries include user identity (new entries only)
- Header user badge (User / Role)

---

## v2.4.0 (Released)

- Data layer refactor (repository pattern)
- ES module data stores
- Backup validate dry-run
- Draft v3 PostgreSQL schema

---

## v2.3.0 (Released)

- Compliance Record Workspace
- Detail View Architecture
- Simplified Main Table
- Evidence Management moved into workspace
- Action Management moved into workspace
- Improved usability and scalability

---

## Version Roadmap

Versions are listed **oldest to newest**. Everything through **v3.0.0** is shipped. **v3.1.0** is next.

### v1.0 — Working prototype · Shipped

* Table of people with DBS expiry dates
* Add, edit, and delete
* localStorage persistence
* Search, status filter, and sort
* CSV import and export
* Validation and error handling
* Summary dashboard

### v1.1 — Reminder engine · Shipped

* Reminder engine (30 / 14 / 7 day windows)
* Reminder settings
* Action Required table and count
* Compliance dashboard (expiring in 30 / 60 / 90 days)
* Quick actions

### v1.2 — Multiple records · Shipped

* Multiple compliance records per person
* Compliance types
* Compliance type filtering
* Notes per compliance record
* One table row per compliance record

### v1.3 — Audit and renewals · Shipped

* Mark reminder sent (audit trail in notes)
* Hide reminders already sent (expired records always show)
* Renew compliance (new expiry date + audit note)

### v1.4 — Compliance analytics · Shipped

* Compliance analytics dashboard (above the records table)
* Compliance health score (% of records with more than 90 days until expiry)
* Total Records, Valid, Expiring 30/60/90, Expired metrics

### v1.5.0 — Advanced filtering · Shipped

* Extended search (name, role, type, notes, dates)
* Expiry window filter dropdown
* Active filter chips and clear-all
* Clickable analytics cards (filter the table from analytics)
* Compatible status/expiry filter handling

### v1.6.0 — Record management and UX · Shipped

* Edit compliance record (name, role, type, expiry, notes)
* Archive confirmation
* Renew UX improvements (clearer dates and feedback)
* Friendly empty states

### v1.7.0 — Audit log and backup · Shipped

* Compliance history log per record
* CSV export with reminder status
* JSON backup export and import

### v1.8.0 — Register usability · Shipped

* Unified table sort control
* Pagination (25 per page)
* Status badges (Valid / Expiring Soon / Expired)
* All Records dashboard card
* Filtered summary strip above the table

### v1.8.1 — QA patch · Shipped

* Safe legacy backup import record counting
* Inline notes history logging
* Skip no-change edit history entries
* Reject empty backups
* Lighter re-renders on pagination and history toggle

### v1.9.0 — Renewal cycles · Shipped

- Renewal cycles
- Smart renewal workflow
- Suggested renewal dates
- Renewal modal
- Backup compatibility
- History integration
- Renewal cycle column in register and CSV export

### v2.0.0 — Compliance documents · Shipped

- Evidence/document storage per compliance record
- Add Evidence modal with optional local file upload
- View Evidence expandable panel
- Delete evidence with confirmation
- History integration for evidence add/delete
- CSV evidence summary columns
- Backup compatibility for evidence metadata

### v2.1.0 — Reports & audit pack · Shipped

- Reports & Audit Pack dashboard
- Full Compliance, Expired, Expiring in 30 Days reports
- Missing Evidence and Evidence Coverage Summary reports
- On-screen report preview with Export CSV and Print

### v2.2.0 — Action tracking · Shipped

- Compliance action/task tracking per record
- Add, complete, reopen, and delete actions
- Default action templates (manual add)
- Action summary dashboard cards
- Open Actions reports in Audit Pack
- CSV and backup support for actions

### v2.3.0 — Record workspace · Shipped

- Compliance Record Workspace detail view
- Details button on each register row
- Simplified table (essential columns only)
- Evidence, actions, history, and notes in workspace
- Close workspace / Escape to return to table
- Live UI sync without page refresh

### v2.4.0 — Data layer refactor · Shipped

- Repository pattern for all persistence
- `js/data/` modules (local store, settings store, cloud stub)
- `DATA_BACKEND` feature flag (`local` | `cloud`)
- Backup validate dry-run
- ES module entry point for `app.js`
- Draft PostgreSQL schema for v3 migration

### v2.5.0 — Auth shell · Shipped

- `AUTH_MODE` config (`local` | `supabase-preview`)
- Mock local session (`local-user`, admin role)
- `js/auth/session.js` — user, role, and permission helpers
- Header user badge (User / Role)
- History entries store `userId` and `userDisplayName`
- Prepared for Supabase Auth (no cloud login yet)

### v2.5.1 — Direct-open fix · Shipped

- Bundled `app.bundle.js` (ES modules do not run on `file://`)
- Import/export/backup controls wired before other listeners
- Off-screen file inputs and startup error banner
- `npm run build` / `serve.ps1` documented in README

### v2.6.0 — Bulk actions · Shipped

- Bulk record selection
- Bulk actions
- Bulk reminder management
- Export selected CSV
- Selection state improvements

### v2.7.0 — Dashboard & Management Insights · Shipped

Features:

* Management Insights dashboard
* Total Open Actions card
* Actions Linked to Expired Records card
* Records Missing Evidence card
* Expiring This Month card
* Expiring Next Month card
* Compliance Health Score
* Clickable insight cards
* Insight preview table
* Export Insight CSV
* Clear Preview functionality

Benefits:

* Faster identification of compliance risks
* Improved management oversight
* Better prioritisation of actions and evidence collection
* Simplified reporting and operational monitoring

### v2.9.0 — Visual Insights & Compliance Charts · Shipped

- Expiry by Month chart
- Compliance Status Breakdown
- Evidence Coverage chart
- Action Workload chart
- Management Snapshot
- Snapshot CSV export
- Snapshot print support

QA Status: PASS with warnings

### v2.8 — Supabase Auth · Shipped (included in v3.0.0)

- Supabase Auth login/logout
- Real user sessions replacing mock preview user
- Read-only cloud sync (initial)

### v3.0.0 — Cloud Platform Foundation · Shipped

**Date:** June 2026

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions (Admin, Editor, Viewer)
- Compliance CRUD parity (records, actions, evidence metadata, history, archive)
- Verification framework (`npm run verify:phase2`)
- First production release

Status: Released  
Tag: v3.0.0

### v3.0.0 Alpha — Phase 2 (operational cloud) · Shipped (Step 12 hardening)

- Supabase login, org-scoped load, admin/editor/viewer read parity
- Limited RPC writes when explicitly enabled (not default): mark sent, action complete/reopen, action create/delete, renew, add record, edit record (no notes column write); workspace notes via P3-4 RPC
- `canMutateData()` false in cloud; no `CloudComplianceStore.save()`
- Verify: `npm run verify:phase2` — see `docs/cloud-phase2-completion.md`

### Phase 3 — Cloud writes & verification

| Item | Status |
|------|--------|
| P3-1 Verification hardening | **COMPLETE** |
| P3-2 Reminder settings | **COMPLETE** |
| P3-4 Compliance notes | **COMPLETE** |
| P3-5A Action create/delete | **COMPLETE** ✅ |
| P3-5B Action update & in-progress | **COMPLETE** ✅ |
| P3-5C Default & bulk actions | **COMPLETE** ✅ |
| P3-6A Evidence create | **COMPLETE** ✅ |
| P3-6B Evidence delete | **COMPLETE** ✅ |
| P3-6C Evidence update | **COMPLETE** ✅ |
| P3-7A Record archive/delete | **COMPLETE** ✅ |
| P3-8 Final hardening / RC | **COMPLETE** ✅ |

#### P3-8 Final hardening / release candidate · Complete

**Status:** COMPLETE ✅

- Phase 3 cloud-write audit (RPC-only browser writes; permission gating documented)
- `npm run verify:phase2` — v3.0.0 release gate (migrations through `20260203000016`, pre/post reset)
- `reset-alpha-staging-data.mjs` — canonical counts (5/6/2/2/3/1); Step10 + P37A cleanup
- Docs: `docs/v3-release-checklist.md`, `docs/cloud-phase3-completion.md`, README/data-layer/cloud-setup
- Application version: `v3.0.0-rc1` (RC); GA **`v3.0.0`** released June 2026
- Recommended tag: `v3.0.0`

#### P3-1 Verification hardening · Complete

**Status:** COMPLETE

- `npm run verify:phase2` — single entry point for automated cloud verification + build
- Pre/post staging reset via `reset-alpha-staging-data.mjs` (idempotent; canonical seed counts)
- Step10 Verify person cleanup and Alex Volunteer two-record invariant in reset
- Per-feature cloud write smoke scripts wired into the phase2 suite

#### P3-2 Reminder settings · Complete

**Status:** COMPLETE

- RPC `update_reminder_settings` (migration `20260203000006`) — org-level `days_30`, `days_14`, `days_7`, `hide_sent_reminders`
- Admin only (`canMutateReminderSettings()` when `CLOUD_WRITES_ENABLED`; editors/viewers denied)
- `canMutateData()` stays false in cloud; RPC-first via `CloudSettingsStore.updateReminderSettings()`
- Existing reminder settings UI works when cloud writes enabled (`?cloudWrites=1` on allowed hosts)
- Verify: `npm run verify-cloud-update-reminder-settings` (included in `verify:phase2`)
- Staging reset restores seed reminder settings (`reset-alpha-staging-data.mjs`)

#### P3-4 Compliance notes · Complete

**Status:** COMPLETE (minimal v1)

- RPC `update_compliance_record_notes` (migration `20260203000007`) — server-side protected-line enforcement
- Editor/admin (`canUpdateComplianceRecordNotes()` when `CLOUD_WRITES_ENABLED`)
- Workspace Save Notes only; edit-form notes disabled in cloud
- Verify: `npm run verify-cloud-update-compliance-record-notes` (in `verify:phase2`)

#### P3-5A Action create/delete · Complete

**Status:** COMPLETE ✅

- RPC `create_action` (migration `20260203000008`) — open action + `action_added` history
- RPC `delete_action` (migration `20260203000009`) — `action_deleted` history before removal
- Editor/admin (`canMutateActions()` when `CLOUD_WRITES_ENABLED`; separate from `canSetActionStatus()`)
- Add Action modal + workspace Add Action + delete button wired
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.createAction()` / `deleteAction()`
- Reset: `pruneNonSeedActions()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-create-delete-action` (in `verify:phase2`)

#### P3-5B Action update & in-progress · Complete

**Status:** COMPLETE ✅

- RPC `set_action_in_progress` (migration `20260203000010`) — open → in_progress + `action_updated` history
- RPC `update_action` (migration `20260203000011`) — metadata only (title, notes, due date, owner); no status/completed fields
- Editor/admin (`canMutateActions()`); Mark in progress + Edit Action modal wired in cloud
- Complete/reopen unchanged (`set_action_status` via `canSetActionStatus()`)
- Edit modal status field hidden in cloud (dedicated RPCs for status transitions)
- Verify: `npm run verify-cloud-action-update-progress` (in `verify:phase2`)

#### P3-5C Default & bulk actions · Complete

**Status:** COMPLETE ✅

- RPC `add_default_actions` (migration `20260203000012`) — five templates; skip duplicate titles per record; one `action_added` history per new action
- Bulk add uses client loop of `create_action` (no bulk SQL RPC); single reload after operation
- Editor/admin (`canMutateActions()`); workspace Add default actions + bulk toolbar wired
- `persistAddDefaultActions()` / `persistBulkCreateAction()` — no `savePeople()` in cloud
- Verify: `npm run verify-cloud-default-bulk-actions` (in `verify:phase2`)

#### P3-5 Action writes · Complete

**Status:** COMPLETE ✅ (P3-5A + P3-5B + P3-5C)

#### P3-6A Evidence create · Complete

**Status:** COMPLETE ✅

- RPC `create_evidence` (migration `20260203000013`) — metadata-only insert into `evidence_items` + `evidence_added` history
- Editor/admin (`canMutateEvidence()` when `CLOUD_WRITES_ENABLED`; separate from `canMutateActions()`)
- Add Evidence modal + workspace Add Evidence wired; file attachments blocked in cloud (metadata only)
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.createEvidence()`
- Reset: `pruneNonSeedEvidence()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-create-evidence` (in `verify:phase2`)
- Not in scope: evidence edit, Storage uploads

#### P3-6B Evidence delete · Complete

**Status:** COMPLETE ✅

- RPC `delete_evidence` (migration `20260203000014`) — `evidence_deleted` history before row removal
- Delete button on evidence items when `canMutateEvidence()` (editor/admin); `persistDeleteEvidence()` + reload
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.deleteEvidence()`
- Verify: `npm run verify-cloud-delete-evidence` (in `verify:phase2`)
- Not in scope: evidence edit, Storage uploads, record archive/delete

#### P3-6C Evidence update · Complete

**Status:** COMPLETE ✅

- RPC `update_evidence` (migration `20260203000015`) — metadata-only update + `evidence_updated` history
- Edit button on evidence items when `canMutateEvidence()`; reuses evidence modal (file input hidden in cloud)
- `persistUpdateEvidence()` + `reloadCloudDataAfterWrite()`; local edit unchanged pattern (in-memory + history)
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.updateEvidence()`
- Verify: `npm run verify-cloud-update-evidence` (in `verify:phase2`)
- **P3-6 evidence metadata CRUD complete** (create / update / delete)
- Not in scope: Storage uploads, file replacement in cloud, record archive/delete

#### P3-7A Record archive/delete · Complete

**Status:** COMPLETE ✅

- RPC `archive_compliance_record` (migration `20260203000016`) — deleted snapshot with record/history/evidence/actions JSON, then remove active row (and person when last record)
- Workspace **Archive Record** when `canArchiveComplianceRecord()`; `persistArchiveComplianceRecord()` + `reloadCloudDataAfterWrite()`
- Local delete unchanged (in-memory snapshot + remove active record); cloud RPC-first (no browser table writes)
- `canMutateData()` stays false in cloud
- Reset: `pruneNonSeedDeletedSnapshots()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-archive-compliance-record` (in `verify:phase2`)
- Not in scope: restore/unarchive, bulk archive/delete

#### Evidence metadata (CRUD) · Complete

**Status:** COMPLETE ✅ (P3-6A / P3-6B / P3-6C)

- Metadata create, update, delete via RPC; Storage buckets / uploads follow-on

**Phase 3 (remaining for GA):** Shipped in v3.0.0 GA (June 2026). Follow-on items moved to [v3.1.0](#v310--cloud-platform-follow-on--planned).

### v3.1.0 — Cloud platform follow-on · Planned

- Production cloud writes policy and GDPR checklist
- Evidence storage buckets and uploads
- CSV/backup import migration path
- Restore/unarchive and bulk archive/delete

---

## v4 — Compliance Insights (release candidate)

V4 adds a read-only **Compliance Insights** layer on the existing dashboard. Application version is **v4.0.0-rc1**.

Documentation: [`docs/compliance-insights.md`](docs/compliance-insights.md)

Verification:

- `npm run verify-insights-release` — full V4 release chain (engine → browser smoke → build)
- `npm run verify:phase2` — v3.0.0 cloud release gate (requires `.env` + staging Supabase)

| Slice | Status | Summary |
|-------|--------|---------|
| V4-0A | **COMPLETE** | Insights engine — normalize rows, health/risk/forecast metrics |
| V4-0B | **COMPLETE** | Dashboard metric mappings to legacy register cards |
| V4-0C | **COMPLETE** | Compliance Insights UI — health score, risk, forecast sections |
| V4-0D | **COMPLETE** | Drilldown filters, preview table, CSV export |
| V4-1A | **COMPLETE** | Recommendations engine and Recommended Actions UI |
| V4-1B | **COMPLETE** | Recommendation polish, threshold constants, documentation |
| V4-1C | **COMPLETE** | Alpha hardening, version bump to v4.0.0-alpha |
| V4-2A | **COMPLETE** | Operational health — reminder follow-up score and recommendation |
| V4-2B | **COMPLETE** | Composite health score includes operational health (4-way average) |
| V4-2C | **COMPLETE** | Operational health drilldown columns, preview explanation, sub-score summary |
| V4-3A | **COMPLETE** | Evidence gap tiers — critical/high/stale classification, cards, drilldowns, tier-based recommendations |
| V4-3B | **COMPLETE** | Compliance Insights UX polish — section hierarchy, helper text, empty states, drilldown preview clarity, recommendation priority badges |
| V4-3C | **COMPLETE** | Compliance Insights export pack — summary CSV, drilldown preview export, dated filenames, read-only export helpers |
| V4-3D | **COMPLETE** | Compliance Insights browser smoke test pack — static DOM/wiring checks for section UI, exports, drilldown preview, and empty states |
| V4-3E | **COMPLETE** | Compliance Insights release verification — single command runs engine, browser smoke, and build checks in order |
| V4-RC | **COMPLETE** | v4.0.0-rc1 prepared — version strings updated; `verify-insights-release` passed |
| V4-RC1A | **COMPLETE** | Browser acceptance checklist and bug capture format — `docs/v4-rc-browser-acceptance.md` |
| V4-RC-HARDENING | **COMPLETE** | RC-001–RC-010 hardening — cloud fixes, terminology, UX clarity; `docs/v4-0-1-release-notes.md` |

**RC hardening (June 2026):** Complete. See [`docs/v4-0-1-release-notes.md`](docs/v4-0-1-release-notes.md) for fixes, verification gates, browser checklist, and tagging steps.

| ID | Summary |
|----|---------|
| RC-001 | Cloud in-progress → completed action transition |
| RC-002 | Cloud bulk mark reminders |
| RC-003 | Filtered register CSV export |
| RC-004 | Terminology consistency |
| RC-005 | Stale evidence insight label clarity |
| RC-006 | Message styling consistency |
| RC-007 | Register count scope clarity |
| RC-008 | Renew workflow wording |
| RC-009 | Cloud evidence metadata-only clarity |
| RC-010 | Final hardening summary and release checklist |

**Constraints (V4 to date):** No new CRUD, migrations (except RC-001 `20260203000017`), cloud-write policy changes, or AI/LLM dependency.

Tag: **v4.0.0-rc1** in source; GA target **v4.0.1** (pending sign-off and version bump).

---

## v5.0.0 — Automated Compliance Operations · In progress (alpha)

**Theme:** From insight to action — scheduled reminders, policy-driven action creation, escalations, and auditable operations on the existing cloud platform.

V4 answers *what needs attention*. V5 **acts on it automatically** once the automation platform ships. **V5-1A Contact Management** (v5.0.0-alpha.1) and **V5-1B Reminder Template Preview** (v5.0.0-alpha.2) establish contact fields and read-only reminder preview before delivery.

**Full roadmap:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md)  
**V5-1A alpha:** [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md)

**Prerequisites:** v4.0.1 GA, v3.1.0 cloud follow-on (evidence Storage, restore/bulk ops, production cloud-writes policy)

| Slice | Status | Summary |
|-------|--------|---------|
| V5-1A | **COMPLETE** | Contact Management — email fields, Contact Readiness insights, drilldown-to-edit; **v5.0.0-alpha.1** |
| V5-1B | **COMPLETE** | Reminder Template Preview — template, preview UI, copy/export, dashboard; **v5.0.0-alpha.2** |
| V5-0 | **IN PROGRESS** | Automation platform — schema, RPCs, dry-run scan engine (Phases 1–5 complete) |
| V5-1 | **PLANNED** | Automated reminders & digests — queue, email delivery, mark sent on delivery |
| V5-2 | **PLANNED** | Automated action orchestration — policies map V4 recommendations → `add_default_actions` |
| V5-3 | **PLANNED** | Escalation & operational closure — missing follow-up → admin notify + audit |
| V5-4 | **PLANNED** | Policy engine GA — templates, dry-run, operations export, `verify:automation` |

**Architecture:** Server-side automation via Supabase Edge Functions + pg_cron; all writes through RPC; history entries tagged `source: automation`. **Cloud-only** — local mode remains manual with clear UI messaging.

**Non-goals:** AI/LLM, third-party DBS APIs, mobile apps, visual workflow builder.

**Alpha tag in source:** v5.0.0-alpha.2  
**GA tag target:** `v5.0.0`

---

## Platform

* GitHub repository
* GitHub Pages deployment

---

## Customer Problems

### Safeguarding Officers

* Chasing expired DBS checks
* Tracking training renewals
* Producing inspection reports
* Knowing who needs action today
* Maintaining audit trails

### Diocesan Administrators

* Multiple parishes using spreadsheets
* No central compliance visibility
* Time-consuming reporting
* Manual reminder chasing

### Volunteer Coordinators

* Forgotten renewals
* Tracking volunteer training
* Maintaining accurate records

### Compliance Teams

* Spreadsheet overload
* Lack of audit history
* Difficulty identifying upcoming risks

---

## Business Ideas

* DBS compliance tracking
* Safeguarding training renewals
* First aid certificate tracking
* Volunteer compliance management
* Diocese compliance management

---

## Notes

This project was built to learn software development and explore a potential SaaS business opportunity.
