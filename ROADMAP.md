# Compliance Reminder System Roadmap

A local-first safeguarding compliance tracker. All data is stored in the browser (localStorage). No backend, login, or email sending.

---

# Current Release

## v2.3.0

- Compliance Record Workspace (detail view per record)
- Simplified main register table with Details button
- Evidence, actions, history, and notes managed in workspace
- Live sync with dashboards, reports, and reminders

---

# Recent Releases

## v2.3.0 (Released)

- Compliance Record Workspace
- Detail View Architecture
- Simplified Main Table
- Evidence Management moved into workspace
- Action Management moved into workspace
- Improved usability and scalability

---

# Next Planned Release

## v2.4.0

- Database integration
- User accounts and login
- Multi-device data storage

---

## Version Roadmap

Versions are listed **oldest to newest**. Everything through **v2.2.0** is shipped. **v2.3.0** is the current release.

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

### v2.3.0 — Record workspace · Current

- Compliance Record Workspace detail view
- Details button on each register row
- Simplified table (essential columns only)
- Evidence, actions, history, and notes in workspace
- Close workspace / Escape to return to table
- Live UI sync without page refresh

### v2.4 — Accounts and sync · Planned

- Database integration
- User accounts and login
- Multi-device data storage

### v3.0 — Multi-organisation · Planned

* Multi-organisation support
* Organisation settings
* User permissions and roles

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
