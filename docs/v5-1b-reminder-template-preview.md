# V5-1B — Reminder Template Preview

**Slice:** V5-1B Reminder Template Preview  
**Phases:** 1 — Template foundation · 2 — Preview UI · 3 — Copy and export · 4 — Preview dashboard  
**Date:** June 2026  
**Prerequisite:** v5.0.0-alpha.1 (V5-1A Contact Management) · **Release:** v5.0.0-alpha.2 (Phase 5 complete)

---

## Summary

V5-1B adds **read-only reminder email template generation, on-screen preview, and copy/export utilities** so safeguarding teams can see and reuse reminder copy before any delivery infrastructure exists. Uses V5-1A person email fields when present. **No email sending, notification queue, automation, Edge Functions, migrations, or permission changes.**

---

## Phase 1 deliverables (foundation)

| Item | Location |
|------|----------|
| Reminder template module | `js/app/reminders/reminder-templates.js` |
| Deterministic verification | `npm run verify-reminder-template-preview` |
| Documentation | this file |

**Out of scope for Phase 1:** preview UI, SMTP/queue, `mark_reminder_sent` automation.

---

## Phase 2 deliverables (preview UI)

| Item | Location |
|------|----------|
| Preview modal | `index.html` — `#reminder-preview-modal` |
| Action Required preview action | `app.js` — `renderReminders()` |
| Workspace preview action (when in reminder window) | `index.html` / `app.js` — `#workspace-preview-reminder-btn` |
| Preview styles | `styles.css` |
| Deterministic UI verification | `npm run verify-reminder-template-preview-ui` |

**Out of scope for Phase 2:** email delivery, SMTP/Resend/Microsoft integration, notification queue, automation, migrations/RPC, permission changes.

---

## Phase 3 deliverables (copy and export)

| Item | Location |
|------|----------|
| Copy/export helpers | `js/app/reminders/reminder-templates.js` — `buildReminderTemplateFullEmailText`, `buildReminderPreviewExportFilename` |
| Modal copy/export actions | `index.html` / `app.js` — preview modal action buttons |
| Deterministic verification | `npm run verify-reminder-template-preview-actions` |

**Out of scope for Phase 3:** email delivery, SMTP/Resend/Microsoft integration, notification queue, automation, migrations/RPC, permission changes.

---

## Phase 4 deliverables (preview dashboard)

| Item | Location |
|------|----------|
| Preview dashboard module | `js/app/reminders/reminder-preview-dashboard.js` |
| Dashboard section | `index.html` — `#reminder-preview-dashboard-section` |
| Card counts and drilldown | `app.js` — `renderReminderPreviewDashboardCards()`, drilldown preview |
| Export reminder pack | `app.js` — `exportReminderPreviewPack()` |
| Dashboard styles | `styles.css` |
| Deterministic verification | `npm run verify-reminder-preview-dashboard` |

### Dashboard cards

Counts include only records that **currently qualify for a reminder** (same most-urgent window logic as Action Required) **and have a person email on file**:

| Card | Drilldown filter |
|------|------------------|
| 30 Day Reminders | Active 30-day window |
| 14 Day Reminders | Active 14-day window |
| 7 Day Reminders | Active 7-day window |
| Expired Reminders | Expired |
| Total Previewable Reminders | All of the above |

Records without email are excluded from counts and drilldowns (see Contact Readiness for missing-email gaps).

### Drilldown columns

| Column | Source |
|--------|--------|
| Person | Person name |
| Email | Normalized person email |
| Compliance Type | Record compliance type |
| Expiry Date | Register expiry (en-GB) |
| Reminder Type | Most urgent active window |

### Drilldown actions

| Action | Behaviour |
|--------|-----------|
| **Preview Reminder** | Opens existing V5-1B preview modal for that row |
| **Open Workspace** | Opens record workspace |
| **Edit Contact** | Opens edit form with email field focused (V5-1A) |

### Export Reminder Pack

Downloads a single `.txt` file containing **all reminder previews** in the current drilldown, separated by `---`. Each section uses the same full-email text shape as Phase 3 (To, manager email when present, reminder type, subject, body). Filename: `reminder-preview-pack-{slug}-{YYYY-MM-DD}.txt` (slug is the card type, e.g. `7-day`, `total`).

**No sending, queue, SMTP, or automation.**

**Out of scope for Phase 4:** email delivery, notification queue, automation, migrations/RPC, permission changes.

---

## Template types

Supported `reminderType` values (same labels as register reminders):

| Window | `reminderType` |
|--------|----------------|
| 30-day | `30 Day Reminder` |
| 14-day | `14 Day Reminder` |
| 7-day | `7 Day Reminder` |
| Expired | `Expired` |

---

## Input

`buildReminderTemplatePreview(input)` accepts:

| Field | Required | Notes |
|-------|----------|-------|
| `personName` | yes | Person display name |
| `complianceType` | yes | e.g. `DBS`, `Basic Awareness` |
| `expiryDate` | yes | ISO date `YYYY-MM-DD` |
| `reminderType` | yes | One of the four template types above |
| `recipientEmail` | no | Normalized person email from V5-1A; `null` when absent |
| `managerEmail` | no | Normalized manager email; surfaced in body for reference only — **not CC/send** |
| `organisationName` | no | Defaults to `Compliance Reminder System` |

`buildReminderTemplatePreviewFromRow(row, reminderType, options?)` maps a normalized compliance row plus explicit reminder type.

---

## Output shape

Every preview object includes:

```javascript
{
  subject: string,
  body: string,
  recipientEmail: string | null,
  managerEmail: string | null,
  reminderType: string,
  complianceType: string,
  expiryDate: string,
}
```

- **subject** — window-specific lead plus compliance type and person name.
- **body** — plain-text copy with expiry date (en-GB format), organisation name, optional manager reference line, and preview disclaimer.
- **recipientEmail** / **managerEmail** — normalized lowercase or `null` when unset.

---

## Preview UI (Phase 2)

### Where to open preview

1. **Action Required / Reminder Engine** — each active reminder row has a **Preview Reminder Email** button alongside **Mark Sent**.
2. **Record workspace** — when the open record is in an active reminder window (30/14/7-day or expired), **Preview Reminder Email** appears in the workspace quick actions.

### Modal contents

| Field | Behaviour |
|-------|-----------|
| Recipient email | Shown from V5-1A contact fields; `—` when missing |
| Manager email | Shown when present; row hidden when absent |
| Reminder type / window | Active reminder label for that row |
| Subject | Generated subject line |
| Body | Plain-text preview body |
| Disclaimer | Prominent note: preview only, no email sent |
| Missing recipient warning | Alert when recipient email is absent; preview still opens |

---

## Copy and export (Phase 3)

### Modal actions

| Action | Behaviour |
|--------|-----------|
| **Copy subject** | Copies generated subject to clipboard |
| **Copy body** | Copies generated body to clipboard |
| **Copy full email** | Copies metadata + subject + body (see below) |
| **Export preview text file** | Downloads `.txt` with the same full email content |

### Full email text shape

Used by **Copy full email** and **Export preview text file**:

```
To: jordan.coordinator@example.com
Manager email: manager@example.com
Reminder type: 14 Day Reminder

Subject: 14-day reminder: Basic Awareness — Jordan Coordinator

Body:
Dear Jordan Coordinator,
...
```

- **To** — recipient email or `—` when missing
- **Manager email** — included only when present on the person record
- **Reminder type**, **Subject**, **Body** — from the generated preview
- Does **not** include record notes, evidence, or other sensitive register content

### Export filename

`reminder-preview-{person-slug}-{YYYY-MM-DD}.txt`

Example: `reminder-preview-jordan-coordinator-2026-06-17.txt`

The date segment uses the export date (today when the user clicks export).

### Clipboard unavailable

When `navigator.clipboard` is unavailable or copy fails, the modal shows a clear warning and **Export preview text file** remains available.

---

## Verification

### Reminder suite (Phase 5 release gate)

```powershell
npm run verify-reminder-suite
```

Runs all four reminder verification scripts in order (see Phase 1–4 below).

### Individual scripts

```powershell
npm run verify-reminder-template-preview
npm run verify-reminder-template-preview-ui
npm run verify-reminder-template-preview-actions
npm run verify-reminder-preview-dashboard
```

**Phase 1** checks:

- All four template types produce the documented output shape
- Deterministic subject/body fragments for fixture input
- Email normalization and optional manager line behaviour
- Module contains no send/queue/automation hooks

**Phase 2** checks:

- Preview modal markup and disclaimer in `index.html`
- Action Required and workspace preview actions wired in `app.js`
- Missing recipient warning without blocking preview
- Bundle includes template preview helpers
- No email delivery or automation hooks in UI wiring

**Phase 3** checks:

- Full email text and export filename helpers
- Copy/export buttons and handlers in modal
- Clipboard-unavailable message; export still wired
- No email delivery or automation hooks

**Phase 4** checks:

- Previewable reminder metrics (qualifying + email only)
- Drilldown filtering by reminder window type
- Export reminder pack text and filename
- Dashboard section, cards, drilldown table, and action wiring in `index.html` / `app.js`
- Reuse of preview modal, workspace, and edit contact (V5-1A / V5-1B)
- No email delivery or automation hooks

---

## Deliberately out of scope (Phases 1–5)

| Item | Notes |
|------|-------|
| Email delivery / SMTP | No `sendEmail` or provider integration |
| Notification queue | No queue tables or enqueue RPC |
| Automation / Edge Functions | No scheduled jobs |
| `mark_reminder_sent` automation | Manual marking unchanged |
| Migrations / RPC / permissions | None |
| Application logic changes in Phase 5 | Docs, verification orchestration, version display only |

---

## Phase 5 deliverables (alpha release gate)

| Item | Location |
|------|----------|
| Combined release notes | `docs/v5-0-0-alpha-2-release-notes.md` |
| Verification suite | `npm run verify-reminder-suite` → `scripts/verify-reminder-suite.mjs` |
| Roadmap update | `ROADMAP.md` — v5.0.0-alpha.2 current release |
| Version strings | `js/data/config.js`, `index.html`, `app.bundle.js` → **v5.0.0-alpha.2** |

### Alpha verification (required before tag)

| Command | Scope |
|---------|-------|
| `npm run verify-reminder-suite` | V5-1B Phases 1–4 static checks |
| `npm run verify-contact-management` | V5-1A + insights regression |
| `npm run verify-insights-release` | Insights subset |
| `npm run verify:phase2` | Cloud + V5-1A contact RPC smokes (requires `.env`) |

### Manual browser acceptance

See [`docs/v5-0-0-alpha-2-release-notes.md`](v5-0-0-alpha-2-release-notes.md) — header version, V5-1A contact regression, preview modal, dashboard drilldown/export, no automation UI.

### Known limitations

Preview-only (no delivery); dashboard counts require person email; manager email is reference-only; local CSV contact import only; clipboard fallback on restricted contexts; V5-0 automation platform not started.

---

## Next slice: V5-0 Automation Platform Foundation

Schema, RPC contracts, daily scan skeleton, and `AUTOMATION_ENABLED` feature flag (off by default). No user-visible automation until V5-1. See [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md).

---

## Related docs

- [`docs/v5-0-0-alpha-2-release-notes.md`](v5-0-0-alpha-2-release-notes.md) — alpha.2 release gate checklist
- [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md) — person email fields and Contact Readiness
- [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md) — broader v5 automation roadmap
