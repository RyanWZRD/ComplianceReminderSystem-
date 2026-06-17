# V5-1B — Reminder Template Preview

**Slice:** V5-1B Reminder Template Preview  
**Phases:** 1 — Template foundation · 2 — Preview UI  
**Date:** June 2026  
**Prerequisite:** v5.0.0-alpha.1 (V5-1A Contact Management)

---

## Summary

V5-1B adds **read-only reminder email template generation and on-screen preview** so safeguarding teams can see what a reminder would say — and who it would target — before any delivery infrastructure exists. Uses V5-1A person email fields when present. **No email sending, notification queue, automation, Edge Functions, migrations, or permission changes.**

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

## Verification

```powershell
npm run verify-reminder-template-preview
npm run verify-reminder-template-preview-ui
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

---

## Deliberately out of scope (Phases 1–2)

| Item | Notes |
|------|-------|
| Email delivery / SMTP | No `sendEmail` or provider integration |
| Notification queue | No queue tables or enqueue RPC |
| Automation / Edge Functions | No scheduled jobs |
| `mark_reminder_sent` automation | Manual marking unchanged |
| Migrations / RPC / permissions | None |

---

## Next phases (indicative)

- **Phase 3+:** Link preview gaps to Contact Readiness drilldowns; delivery queue (see [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md))

---

## Related docs

- [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md) — person email fields and Contact Readiness
- [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md) — broader v5 automation roadmap
