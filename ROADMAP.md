# Compliance Reminder System Roadmap

A local-first safeguarding compliance tracker. All data is stored in the browser (localStorage). No backend, login, or email sending.

---

# Current Release

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

---

# Next Planned Release

## v3.0.0 — Cloud Platform Foundation

- Shared data, user accounts, login, and role permissions (Supabase)
- Cloud persistence and multi-device access
- Migration from existing backup JSON import

See [Future Releases](#future-releases) below for full architecture and goals.

---

# Future Releases

## v3.0.0 — Cloud Platform Foundation

### Goals

- Shared data
- User accounts
- Login
- Role permissions
- Cloud persistence
- Multi-device access

### Target architecture

**Frontend:**

- Current HTML/CSS/JS application

**Backend:**

- Supabase

**Roles:**

- Admin
- Editor
- Viewer

**Data:**

- Compliance records
- Evidence
- Actions
- History
- Reports

### Migration

- Existing backup JSON import into cloud database

---

# Recent Releases

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

Versions are listed **oldest to newest**. Everything through **v2.9.0** is shipped. **v3.0.0** is next.

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
* Total Records, Compliant, Expiring 30/60/90, Expired metrics

### v1.5.0 — Advanced filtering · Shipped

* Extended search (name, role, type, notes, dates)
* Expiry window filter dropdown
* Active filter chips and clear-all
* Clickable analytics cards (filter the table from analytics)
* Compatible status/expiry filter handling

### v1.6.0 — Record management and UX · Shipped

* Edit compliance record (name, role, type, expiry, notes)
* Delete confirmation
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

### v2.8 — Supabase Auth · Planned

- Supabase Auth login/logout
- Real user sessions replacing mock preview user
- Read-only cloud sync (initial)

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
| Delete/archive | **PLANNED** |
| Evidence metadata (edit/delete) | **PLANNED** |

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
- Not in scope: evidence edit/delete, Storage uploads

#### Delete/archive · Planned

**Status:** PLANNED

- Cloud delete compliance record and archive/snapshot flows
- Import migration path for deleted-record history

#### Evidence metadata (edit/delete) · Planned

**Status:** PLANNED (create in P3-6A)

- Evidence edit/delete RPCs; Storage buckets / uploads follow-on

**Phase 3 (remaining):** delete/archive, evidence edit/delete; CSV/backup import; backup migration tooling; optional notes protection negative test / local parity.

### v3.0.0 — Cloud Platform Foundation (remaining) · Planned

- Production cloud writes policy and GDPR checklist
- Evidence storage buckets and uploads
- CSV/backup import migration path
- Full local parity in cloud (evidence edit/delete, import — reminder settings and workspace notes in P3-2 / P3-4; action writes in P3-5; evidence create in P3-6A)

See [v3.0.0 — Cloud Platform Foundation](#v300--cloud-platform-foundation) above for full goals and architecture.

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
