# V5-1B — Reminder Template Preview (Phase 1)

**Slice:** V5-1B Reminder Template Preview  
**Phase:** 1 — Template preview foundation  
**Date:** June 2026  
**Prerequisite:** v5.0.0-alpha.1 (V5-1A Contact Management)

---

## Summary

V5-1B Phase 1 adds **read-only reminder email template generation** so safeguarding teams can preview reminder copy and recipient context before any delivery infrastructure exists. Uses V5-1A person email fields when present. **No email sending, notification queue, automation, Edge Functions, migrations, or permission changes.**

---

## Phase 1 deliverables

| Item | Location |
|------|----------|
| Reminder template module | `js/app/reminders/reminder-templates.js` |
| Deterministic verification | `npm run verify-reminder-template-preview` |
| Documentation | this file |

**Out of scope for Phase 1:** preview UI, SMTP/queue, `mark_reminder_sent` automation, bundle wiring.

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

## Verification

```powershell
npm run verify-reminder-template-preview
```

Checks:

- All four template types produce the documented output shape
- Deterministic subject/body fragments for fixture input
- Email normalization and optional manager line behaviour
- Module contains no send/queue/automation hooks
- `app.js` / bundle not wired to preview module yet (Phase 1)

---

## Deliberately out of scope (Phase 1)

| Item | Notes |
|------|-------|
| Email delivery / SMTP | No `sendEmail` or provider integration |
| Notification queue | No queue tables or enqueue RPC |
| Automation / Edge Functions | No scheduled jobs |
| Preview UI | Planned later V5-1B phase |
| `mark_reminder_sent` automation | Manual marking unchanged |
| Migrations / RPC / permissions | None |

---

## Next phases (indicative)

- **Phase 2+:** Preview UI in register or workspace; link to Contact Readiness gaps
- **V5-0 / V5-1 automation:** Server-side window evaluation, queue, and delivery (see [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md))

---

## Related docs

- [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md) — person email fields and Contact Readiness
- [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md) — broader v5 automation roadmap
