# Compliance Reminder System Roadmap

## Current Version

**v1.4 — Compliance Analytics** (latest release)

A local-first safeguarding compliance tracker. All data is stored in the browser (localStorage). No backend, login, or email sending.

---

## Version Roadmap

Versions are listed **oldest to newest**. Everything through **v1.4** is shipped. **v1.5** and above are planned.

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

### v1.4 — Compliance analytics · Shipped · Current

* Compliance analytics dashboard (above the records table)
* Compliance health score (% of records with more than 90 days until expiry)
* Total Records, Compliant, Expiring 30/60/90, Expired metrics

### v1.5 — Reporting and bulk actions · Planned

* Email reminder simulation
* Reminder history
* Clickable analytics cards (filter the table from analytics)
* Bulk actions
* Better reporting and CSV templates

### v2.0 — Accounts and sync · Planned

* Database integration
* User accounts and login
* Multi-device data storage

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
