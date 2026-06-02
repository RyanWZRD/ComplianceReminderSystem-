# Compliance Reminder System Roadmap

A local-first safeguarding compliance tracker. All data is stored in the browser (localStorage). No backend, login, or email sending.

---

# Current Release

## v2.7.0

### Dashboard & Management Insights

- Management Insights dashboard
- Total Open Actions, expired-linked actions, missing evidence, and expiry insight cards
- Compliance Health Score
- Clickable insight cards with preview table, Export Insight CSV, and Clear Preview

---

# Next Planned Release

## v2.8.0

- Supabase Auth integration (real login)

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

Versions are listed **oldest to newest**. Everything through **v2.7.0** is shipped. **v2.8.0** is next.

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

### v2.8 — Supabase Auth · Planned

- Supabase Auth login/logout
- Real user sessions replacing mock preview user
- Read-only cloud sync (initial)

### v3.0.0 — Cloud Platform Foundation · Planned

- Shared data and cloud persistence (Supabase)
- User accounts, login, and multi-device access
- Role permissions (Admin, Editor, Viewer)
- Compliance records, evidence, actions, history, and reports in the cloud
- Migration path: existing backup JSON import into cloud database

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
