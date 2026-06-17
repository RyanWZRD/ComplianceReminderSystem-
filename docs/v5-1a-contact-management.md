# V5-1A — Contact Management (alpha)

**Release:** v5.0.0-alpha.1  
**Slice:** V5-1A Contact Management  
**Date:** June 2026  
**Scope:** Documentation and verification checkpoint only in Phase 7 — no new product functionality.

---

## Summary

V5-1A adds **person contact fields** (email and manager email) across the local and cloud data layers, register UI, CSV import/export, Compliance Insights **Contact Readiness**, and a drilldown-to-edit workflow. Fields are optional; validation is format-only (no deliverability checks). No email sending, automation, or permission changes.

Application version in source: **v5.0.0-alpha.1**.

**Next planned slice:** [V5-1B — Reminder Template Preview](#next-slice-v5-1b-reminder-template-preview).

---

## What V5-1A includes

| Phase | Deliverable | Location |
|-------|-------------|----------|
| 1 | Email validation module — normalize, validate, Postgres field mapping | `js/data/email.js` |
| 2 | Local data model — `email`, `managerEmail` on person records | `js/data/local-store.js` |
| 2 | Cloud mapper — `email` / `manager_email` round-trip | `js/data/cloud-mapper.js` |
| 2 | Postgres columns + `normalize_email` / `is_valid_email` helpers | migration `20260301000001` |
| 2 | Create/edit RPC support — optional contact args, validation, history | migration `20260301000002`, `create-compliance-record.js`, `edit-compliance-record.js` |
| 3 | Add/edit UI forms — Email and Manager Email fields | `index.html`, `app.js` |
| 3 | Workspace display — Contact Information section with status badges | `app.js` (`renderRecordWorkspace`, `getContactEmailStatus`) |
| 4 | Register email column (Manager Email not shown in table) | `index.html`, `app.js` |
| 4 | CSV import/export — optional `Email` / `Manager Email` columns; legacy headers compatible | `app.js`, `verify-register-csv-contact-fields.mjs` |
| 5 | Contact Readiness Insights — metrics, cards, drilldowns, recommendations, export | `js/app/insights/metrics-contact-readiness.js`, insights engine/UI |
| 6 | Drilldown-to-edit workflow — Edit Contact action, row opens workspace, `focusContact` on edit | `compliance-insights-drilldowns.js`, `app.js` |
| 7 | Alpha release gate — docs, `verify-contact-management`, version bump | this document |

### Contact field behaviour

- **Optional:** blank or absent means unset (`null` in cloud, `""` in local).
- **Normalization:** trim + lowercase before save (client and server).
- **Validation:** practical format check (`^[^\s@]+@[^\s@]+\.[^\s@]+$`); invalid values blocked on add/edit and local CSV import.
- **Person-scoped:** email is stored on `people`, not per compliance record; shared across all records for the same person.
- **Cloud CSV import:** still blocked (`rejectIfReadOnly()`); contact fields are set via add/edit forms and RPC only.

### Permissions (unchanged)

- **Local:** same as existing record CRUD.
- **Cloud:** editor/admin can set contact fields via `create_compliance_record` / `update_compliance_record` when `CLOUD_WRITES_ENABLED`; viewers read-only.

---

## Deliberately out of scope

| Item | Notes |
|------|-------|
| Email delivery / SMTP / digests | No `sendEmail`, notification queue, or automation hooks |
| Reminder template preview | Planned V5-1B |
| Server-side reminder window evaluation | Planned under broader v5 automation (see `docs/v5-automated-compliance-operations.md`) |
| Per-person notification preferences | Future v5.x |
| Email deliverability / MX checks | Format validation only |
| Manager Email in register table column | Shown in workspace and CSV only |
| Cloud CSV import of contact fields | Import remains local-only |
| New permissions or RLS policy changes | Uses existing editor/admin RPC gates |
| Contact history audit entries | Contact changes logged via existing record `edited` history when other fields change |
| GDPR / retention for contact data | Follows existing person record handling |

---

## Database migrations

Staging must include both V5-1A migrations before cloud contact smokes in `verify:phase2`:

| Migration | Purpose |
|-----------|---------|
| `20260301000001_people_contact_fields.sql` | `people.email`, `people.manager_email`; `normalize_email`, `is_valid_email` |
| `20260301000002_compliance_record_contact_rpc.sql` | Optional `p_email` / `p_manager_email` on `create_compliance_record` and `update_compliance_record` |

```powershell
npx supabase migration list
supabase db push
```

Cloud smokes exercising contact fields:

- `verify-cloud-load` — contact fields on person load
- `verify-cloud-create-compliance-record` — create with email, invalid email rejection
- `verify-cloud-edit-compliance-record` — update contact fields

---

## Verification commands

Run from repository root.

### 1. V5-1A alpha gate (no Supabase required)

```powershell
npm run verify-contact-management
```

Runs in order:

1. `verify-register-csv-contact-fields` — register column, CSV headers, import/export, validation
2. `verify-contact-readiness-workspace` — drilldown Edit Contact, workspace section, no automation hooks
3. `verify-insights-engine` — contact readiness metrics, drilldowns, recommendations, export lines
4. `verify-insights-browser` — Contact Readiness section DOM/wiring
5. `build`
6. `verify-terminology-rc004` through `verify-terminology-rc009` — V4 RC terminology regression

### 2. Compliance Insights release chain (subset of alpha gate)

```powershell
npm run verify-insights-release
```

Same as above except **without** `verify-register-csv-contact-fields`. Use for insights-only regression.

### 3. Cloud release gate (requires `.env` + staging Supabase)

```powershell
npm run verify:phase2
```

Includes V5-1A cloud and static checks:

- `verify-register-csv-contact-fields`
- `verify-contact-readiness-workspace`
- `verify-cloud-load`, `verify-cloud-create-compliance-record`, `verify-cloud-edit-compliance-record`

Also runs full Phase 2 + Phase 3 RPC smokes, pre/post staging reset, insights engine, build, and terminology gates.

### Standalone contact scripts

| Command | Phase |
|---------|-------|
| `npm run verify-register-csv-contact-fields` | 4 |
| `npm run verify-contact-readiness-workspace` | 6 |

---

## Manual browser checklist

Use **local mode** for CSV import checks; use **cloud + `?cloudWrites=1`** on staging for RPC contact saves.

### Header and version

| Check | ☐ |
|-------|---|
| Header shows **v5.0.0-alpha.1** after load | |

### Add / edit forms (local and cloud)

| Check | ☐ |
|-------|---|
| Add Person form shows Email and Manager Email (optional) | |
| Edit form shows Email and Manager Email pre-filled from person | |
| Invalid email (e.g. `not-an-email`) shows validation error; record not saved | |
| Valid emails save; cloud reload shows normalized lowercase values | |
| Clearing email field saves as unset (empty / null) | |

### Register and workspace

| Check | ☐ |
|-------|---|
| Register table shows **Email** column; no Manager Email column | |
| Workspace **Contact Information** section shows email, manager email, and status badge | |
| **Missing Email** / **Email Present** badges match person data | |

### CSV (local mode)

| Check | ☐ |
|-------|---|
| Export CSV includes Email and Manager Email columns | |
| Import legacy CSV (no contact columns) succeeds; existing contacts preserved | |
| Import extended CSV updates contact fields | |
| Import row with invalid email is skipped with clear feedback | |
| Cloud mode: CSV import blocked with read-only message | |

### Compliance Insights — Contact Readiness

| Check | ☐ |
|-------|---|
| Contact Readiness section shows people with/missing email counts | |
| Drilldown preview lists people; **Edit Contact** opens edit form focused on email | |
| Clicking drilldown row (not Edit Contact) opens workspace for relevant record | |
| Recommendation **contact-missing-email** appears when people lack email | |
| Export summary CSV includes contact readiness metric lines | |

### Regression (no new automation)

| Check | ☐ |
|-------|---|
| No send-email or digest UI added | |
| Existing insights, register CRUD, and cloud writes unchanged aside from contact fields | |

---

## Next slice: V5-1B Reminder Template Preview

**Goal:** Preview reminder copy and recipient context before any automated delivery (foundation for v5 notification work).

**Planned scope (indicative):**

- Read-only preview of reminder content for records in 30/14/7-day windows
- Uses person email when present; surfaces missing-email gap from V5-1A Contact Readiness
- No queue, SMTP, or `mark_reminder_sent` automation
- Static/browser verification pack; optional staging smoke when templates touch RPC

See [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md) for the broader v5 automation roadmap.

---

## Phase 7 deliverables (this checkpoint)

- [x] `docs/v5-1a-contact-management.md` (this file)
- [x] `docs/v5-automated-compliance-operations.md` — V5-1A status and sequencing
- [x] `ROADMAP.md` — v5.0.0-alpha.1 current release entry
- [x] `npm run verify-contact-management`
- [x] Version strings → **v5.0.0-alpha.1** (`js/data/config.js`, `index.html`, rebuilt `app.bundle.js`)
- [x] No git tag (unless explicitly requested)

**Behaviour:** No application logic changes in Phase 7 — documentation, verification orchestration, and version display only.
