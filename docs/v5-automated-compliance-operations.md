# v5.0.0 — Automated Compliance Operations

**Theme:** Move from *knowing* what needs attention (V4 Compliance Insights) to *acting on it automatically* — scheduled reminders, orchestrated actions, escalations, and auditable operations.

**Target:** v5.0.0 (major release)  
**Current alpha:** V6.1 Phase 1 — Beta Validation (baseline **v6.0.0-beta.1**; see [`docs/v6-beta-validation.md`](v6-beta-validation.md))  
**Prior alpha:** v5.0.0-alpha.5 — V5-2 Template & Digest Foundation; v5.0.0-alpha.4 — V5-1 Reminder Queue Foundation; v5.0.0-alpha.3 — V5-0 Automation Platform Foundation; v5.0.0-alpha.2 — V5-1A + V5-1B (see [`docs/v5-0-0-alpha-2-release-notes.md`](v5-0-0-alpha-2-release-notes.md))  
**Prerequisites:** v4.0.1 GA, v3.1.0 cloud follow-on (evidence Storage, restore/bulk ops, production cloud-writes policy)  
**Date:** Planned — post v4.0.1 sign-off (June 2026+)

---

## Executive summary

Today the Compliance Reminder System excels at **visibility**: register management, rule-based insights, recommendations, and manual reminder tracking. Safeguarding officers still **chase** — marking reminders sent, adding default actions one record at a time, and checking the dashboard for overdue items.

**v5.0.0** introduces **Automated Compliance Operations**: server-scheduled jobs, notification delivery, policy-driven action creation, and escalation paths — all gated by org roles, logged in history, and verified with the existing RPC + smoke-test framework.

| Today (v4) | v5 goal |
|------------|---------|
| Recommendations are read-only suggestions | Recommendations can trigger **automation playbooks** |
| Reminders appear in UI; user marks sent manually | **Scheduled reminder delivery** (email digest + optional in-app queue) |
| Default actions added manually per record | **Auto-provision actions** when records enter risk states |
| Operational health score measures follow-up gaps | **Escalation rules** close the loop when follow-up is missed |
| No background processing | **Daily compliance scan** per organisation via Supabase |

**Non-goals for v5.0.0:** AI/LLM decision-making, third-party DBS API integration, mobile native apps, multi-tenant billing.

---

## Problem statement

### Safeguarding Officers

- Still manually checking who needs a reminder today
- No outbound notification when a DBS or training certificate enters a window
- Repeat work: same default actions on every new expiring record

### Diocesan Administrators

- No central **automation policy** across parishes
- Cannot prove reminders were **sent** vs merely **listed**
- Weekly reporting still requires logging in and exporting CSV

### Compliance Teams

- Insights identify risk; **nothing happens** until someone acts
- Escalation (e.g. expired + no evidence + overdue action) is tribal knowledge, not system behaviour
- Audit trail shows manual marks, not automated delivery receipts

---

## Architecture direction

V5 adds a **server-side automation layer** on top of the existing RPC-only write model. The browser remains the primary UI; automation runs in Supabase.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (app.js) — unchanged CRUD + new Automation Settings UI │
└────────────────────────────┬────────────────────────────────────┘
                             │ RPC read/write (existing pattern)
┌────────────────────────────▼────────────────────────────────────┐
│  Supabase Postgres — compliance data + new automation tables      │
│  • automation_policies   • notification_queue                    │
│  • automation_runs       • delivery_log                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ invoked by schedule
┌────────────────────────────▼────────────────────────────────────┐
│  Edge Functions / pg_cron                                        │
│  • daily_compliance_scan                                         │
│  • process_notification_queue                                    │
│  • apply_automation_policies                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  Notification providers (v5.1+: email via Resend/SMTP)           │
└─────────────────────────────────────────────────────────────────┘
```

**Principles (carry forward from v3/v4):**

- All automated **writes** go through RPC — no direct table mutation from Edge Functions
- Automation respects **role permissions** (admin configures; editors receive; viewers read logs)
- Every automated action appends **history** entries with `source: automation` and run id
- Local mode: automation **disabled** with clear UI messaging (cloud-only feature)
- Insights engine reused as the **rules input** — same thresholds, same drilldown keys

---

## Release slices

Slices are ordered **V5-1A (contact foundation) → V5-1B (preview) → V5-0 → V5-1 automation → V5-2 → V5-4**. Contact Management shipped as **v5.0.0-alpha.1**; Reminder Template Preview as **v5.0.0-alpha.2**; automation platform foundation as **v5.0.0-alpha.3**; reminder queue foundation as **v5.0.0-alpha.4**; template & digest foundation as **v5.0.0-alpha.5**; live reminder delivery follows in subsequent V5-1 slices.

### V5-1A — Contact Management · **COMPLETE (alpha)**

**Goal:** Capture person contact emails locally and in cloud so insights and future reminder delivery have recipient data.

**Status:** COMPLETE — application version **v5.0.0-alpha.1**. Full checklist: [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md).

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Email validation module (`js/data/email.js`) | **COMPLETE** |
| 2 | Local model, cloud mapper, Postgres columns, create/edit RPC | **COMPLETE** |
| 3 | Add/edit forms, workspace Contact Information section | **COMPLETE** |
| 4 | Register Email column; CSV import/export | **COMPLETE** |
| 5 | Contact Readiness Insights (metrics, drilldowns, export) | **COMPLETE** |
| 6 | Drilldown Edit Contact → edit form / workspace | **COMPLETE** |
| 7 | Alpha release gate — docs, `verify-contact-management`, version bump | **COMPLETE** |

**Migrations:** `20260301000001_people_contact_fields.sql`, `20260301000002_compliance_record_contact_rpc.sql`

**Verification:** `npm run verify-contact-management` (no Supabase); cloud contact smokes in `npm run verify:phase2`.

**Out of scope:** email delivery, automation, cloud CSV import, permission changes.

**Next slice:** V5-1B Reminder Template Preview (read-only reminder copy; no queue or SMTP).

---

### V5-1B — Reminder Template Preview · **COMPLETE (alpha)**

**Goal:** Preview reminder content and recipient context for records in reminder windows before automated delivery.

**Status:** COMPLETE — application version **v5.0.0-alpha.2**. Full checklist: [`docs/v5-1b-reminder-template-preview.md`](v5-1b-reminder-template-preview.md) · release notes: [`docs/v5-0-0-alpha-2-release-notes.md`](v5-0-0-alpha-2-release-notes.md).

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Template module (`js/app/reminders/reminder-templates.js`) | **COMPLETE** |
| 1 | Output shape — subject, body, recipient/manager email, reminder type | **COMPLETE** |
| 1 | `npm run verify-reminder-template-preview` | **COMPLETE** |
| 2 | Reminder preview UI (Action Required + workspace) | **COMPLETE** |
| 2 | Missing-email surfacing in preview | **COMPLETE** |
| 2 | `npm run verify-reminder-template-preview-ui` | **COMPLETE** |
| 3 | Copy subject/body/full email + export text file | **COMPLETE** |
| 3 | `npm run verify-reminder-template-preview-actions` | **COMPLETE** |
| 4 | Reminder Preview Dashboard — cards, drilldown, export pack | **COMPLETE** |
| 4 | `npm run verify-reminder-preview-dashboard` | **COMPLETE** |
| 5 | Alpha release gate — docs, `verify-reminder-suite`, version bump | **COMPLETE** |

**Verification:** `npm run verify-reminder-suite` (no Supabase).

**Constraints:** Read-only preview; no notification queue, SMTP, Edge Functions, migrations, or permission changes in Phases 1–5.

**Next slice:** V5-0 Automation Platform Foundation.

---

### V5-0 — Automation platform foundation · **COMPLETE (alpha)**

**Goal:** Schema, RPC contracts, and run infrastructure without user-visible automation yet.

**Status:** COMPLETE — application version **v5.0.0-alpha.3**. Phases 1–8 implementation plus Phase 9 release-readiness gate. No live automation execution.

**Release-readiness note (v5.0.0-alpha.3):**

- Schema complete (`automation_policies`, `automation_runs`, `AUTOMATION_ENABLED` flag)
- RPC creation/listing complete (policy admin + run read/create RPCs)
- Dry-run scan complete (`computeAutomationDryRun` — no writes)
- Dry-run logging complete (`logAutomationDryRunRun` — audit rows only, execution counters zero)
- Audit UI complete (read-only Automation Audit dashboard; no execution buttons)
- Orchestrated verification complete (`npm run verify-automation-v5-foundation`)
- **No live automation execution yet** — no reminder delivery, queue processing, policy apply, cron, or Edge Functions

**Implementation phases (incremental):**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | `automation_policies` + `automation_runs` tables, `AUTOMATION_ENABLED` flag | **COMPLETE** |
| 2 | RPC `get_automation_policies` / `upsert_automation_policy` | **COMPLETE** |
| 3 | RPC `list_automation_runs` / `get_automation_run` | **COMPLETE** |
| 4 | RPC `create_automation_run` (audit record only) | **COMPLETE** |
| 5 | Dry-run scan engine (`js/app/automation/automation-dry-run.js`) | **COMPLETE** |
| 6 | Dry-run run logging (`js/app/automation/automation-run-logging.js`) | **COMPLETE** |
| 7 | Automation run audit UI (`js/app/automation/automation-run-audit-ui.js`) | **COMPLETE** |
| 8 | Foundation verification orchestrator (`scripts/verify-automation-v5-foundation.mjs`) | **COMPLETE** |
| 9 | Release readiness / alpha tag prep (`v5.0.0-alpha.3`) | **COMPLETE** |

**Release candidate:** **v5.0.0-alpha.3**

**Release verification:** `npm run build` · `npm run verify-automation-v5-foundation`

**Phase 5 dry-run output shape:**

```json
{
  "asOfDate": "2026-06-17",
  "totalRecords": 6,
  "reminderCandidates": {
    "total": 3,
    "byType": { "30-day": 1, "14-day": 1, "7-day": 0, "expired": 1 },
    "withEmail": 0,
    "missingEmail": 3
  },
  "actionCandidates": {
    "expiredRecords": 1,
    "criticalEvidenceGaps": 3,
    "missingFollowUp": 3
  },
  "escalationCandidates": {
    "expiredNoFollowUp": 1,
    "missingEmailInReminderWindow": 3
  }
}
```

Reuses existing insights logic: reminder window detection, Contact Readiness, Evidence Gap tiers, Operational Health missing follow-up, and Compliance Insights normalisation. **No writes** — no email delivery, notification queue, cron, Edge Functions, action creation, reminder mark-sent updates, policy execution, or UI.

**Phase 6 dry-run run logging:**

`logAutomationDryRunRun({ db, organisationId, actorProfileId, dryRunResult, source })` connects the Phase 5 dry-run scan engine to `automation_runs` for audit only. Each call inserts one completed run row via `create_automation_run` with `summary.runType: "dry_run"`, `summary.source` (default `"manual_dry_run"`), the full `summary.dryRun` payload, and execution outcome counters explicitly zero (`policiesApplied`, `remindersQueued`, `remindersSent`, `actionsCreated`, `escalationsFired`, etc.). Repeated logging appends separate audit rows — never overwrites.

**Audit-only — does not execute automation.** Phase 6 does not send emails, create reminders, update compliance records, change action status, or mutate people/records/evidence/history. Real reminder delivery, queue processing, and policy execution remain out of scope (V5-1+).

**Phase 7 automation run audit UI:**

Read-only **Automation Audit** dashboard section loads `automation_runs` for the signed-in organisation via `automationRepository.loadAutomationRuns()` (RPC `get_automation_runs`). Displays run date/time, run type, status, source, records scanned, reminder/action candidate totals, and execution counters (zero for dry-runs). **View summary** expands a row showing the full `summary` JSON via `textContent` (no HTML injection). Empty state: “No automation runs logged yet.” Load failures show a friendly message. Local mode shows cloud-only hint. **No buttons execute automation** — no dry-run trigger, no reminder/action send hooks in `app.js`.

**Phase 8 foundation verification orchestrator:**

`npm run verify-automation-v5-foundation` runs phases 1–7 verification scripts in order (schema, policies, run read/create RPCs, dry-run scan, dry-run logging, audit UI). Stops on first failure. Verification-only — no reminder/action/email execution.

**Verification:** `npm run verify-automation-v5-foundation` (master gate); individual phase scripts remain available for targeted checks.

| ID | Deliverable | Notes |
|----|-------------|-------|
| V5-0A | `automation_policies` table | Org-scoped; JSON policy document; enabled flag; version |
| V5-0B | `automation_runs` table | Run id, org, started/completed, status, summary counts, error |
| V5-0C | `notification_queue` + `delivery_log` | Outbound message queue; per-recipient status |
| V5-0D | RPC `get_automation_policies` / `upsert_automation_policy` | Admin only |
| V5-0E | RPC `list_automation_runs` / `get_automation_run` | Admin + editor read |
| V5-0F | Edge Function `daily_compliance_scan` (skeleton) | Invokes insights-equivalent logic server-side; writes run record only |
| V5-0G | Feature flag `AUTOMATION_ENABLED` | URL param + org setting; off by default |
| V5-0H | Verify: `verify-automation-schema` | Migration + RPC smoke |

**Exit criteria:** Staging cron fires daily scan; run logged; no notifications sent.

---

### V5-1 — Automated reminders & digests · **FOUNDATION COMPLETE (alpha)**

**Goal:** Replace manual “who needs a reminder today?” with scheduled identification and delivery.

**Prerequisite slices:** V5-1A Contact Management (shipped), V5-1B Reminder Template Preview (shipped), V5-0 automation platform (shipped).

**Status:** Foundation complete — application version **v5.0.0-alpha.4**. Phases 1–4 implementation plus Phase 5 release-readiness gate. No live email sending.

**Release-readiness note (v5.0.0-alpha.4):**

- Queue generation complete (`buildReminderQueueFromDryRun` — in-memory from dry-run candidates)
- Queue preview UI complete (read-only Reminder Queue Preview dashboard section)
- Queue CSV export complete (`buildReminderQueueExportCsv` — manual review/chasing only)
- Queue verification orchestrator complete (`npm run verify-reminder-queue-foundation`)
- **No live email sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

**Implementation phases (incremental):**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Reminder queue foundation (`js/app/automation/reminder-queue.js`) | **COMPLETE** |
| 2 | Reminder queue preview UI (read-only dashboard section) | **COMPLETE** |
| 3 | Reminder queue preview CSV export (`js/app/automation/reminder-queue-export.js`) | **COMPLETE** |
| 4 | Foundation verification orchestrator (`scripts/verify-reminder-queue-foundation.mjs`) | **COMPLETE** |
| 5 | Release readiness / alpha tag prep (`v5.0.0-alpha.4`) | **COMPLETE** |

**Release candidate:** **v5.0.0-alpha.4**

**Release verification:** `npm run build` · `npm run verify-reminder-queue-foundation`

**Phase 1 reminder queue foundation:**

`buildReminderQueueFromDryRun({ dryRunResult, asOfDate, rows, settings })` converts dry-run reminder candidates into in-memory queue items with person name, compliance type, expiry date, reminder window/type, email (or null), `status: "queued"`, `source: "dry_run_candidate"`, and execution fields explicitly false/null (`sent`, `delivered`, `markedSent`, timestamps, `failed`, `failureReason`). Missing-email candidates are still queued and flagged with `emailMissing: true`. **Queue-only** — no email delivery, mark-sent, compliance/action mutation, history writes, or live automation execution.

**Phase 2 reminder queue preview UI:**

Read-only **Reminder Queue Preview** card on the dashboard uses `computeAutomationDryRun` + `buildReminderQueueFromDryRun` over the current compliance dataset. Shows person name, compliance type, expiry date, reminder window/type, email or “Missing email”, `status: queued`, `source: dry_run_candidate`, plus summary counts (total queued, missing email, expired, 30/14/7-day). Empty state: “No reminder queue items for this scan.” Safety note: “Preview only — no reminders are sent.” **Preview-only** — no send button, run automation button, mark-sent control, or execution handler.

**Phase 3 reminder queue CSV export:**

**Export queue CSV** downloads the current preview rows for manual review/chasing. Columns: person name, compliance type, expiry date, reminder window/type, email, email missing (Yes/No), status, source, as of date. CSV escaping handles commas, quotes, line breaks, and missing values. Export button is disabled when the queue is empty; clicking export with no rows shows the same friendly empty message. **Export-only** — no email delivery, mark-sent, or compliance/action/history mutation.

**Phase 4 reminder queue foundation orchestrator:**

`npm run verify-reminder-queue-foundation` runs `verify-automation-v5-foundation`, then V5-1 phases 1–3 verification scripts in order (queue module, preview UI, CSV export). Stops on first failure. Verification-only — no reminder/action/email execution.

**Verification:** `npm run verify-reminder-queue-foundation` (master gate); individual phase scripts remain available for targeted checks (no Supabase).

| ID | Deliverable | Notes |
|----|-------------|-------|
| V5-1C | Server-side reminder window evaluation | Port `metrics-operational.js` logic; honour org `reminder_settings` |
| V5-1D | RPC `enqueue_reminder_notifications` | Creates queue rows for records entering 30/14/7-day windows not yet sent |
| V5-1E | RPC `mark_reminder_sent` automation variant | System actor; history `reminder_sent` with `automated: true` |
| V5-1F | Email digest template | Weekly + daily options; parish name, record table, deep link to register filter |
| V5-1G | Edge Function `process_notification_queue` | Batch send; retry; dead-letter after N attempts |
| V5-1H | Automation Settings UI — Reminders tab | Enable/disable auto-send; digest schedule; recipient roles/emails |
| V5-1I | Operations log UI | Recent runs, reminders queued/sent/failed |
| V5-1J | Verify: `verify-automation-reminders` | Seed expiring record → scan → queue → mock send → history |

**User story:** *As a safeguarding officer, I receive a Monday digest of all records needing follow-up this week, and the system marks reminders sent when the digest is delivered.*

**Constraints:** Email requires Supabase secrets (SMTP/Resend); document in `docs/cloud-setup.md`. Local mode shows “Automation requires cloud” banner.

---

### V5-2 — Reminder email template builder · **COMPLETE (alpha)**

**Goal:** Generate reusable email/template content from reminder queue items without sending.

**Prerequisite slices:** V5-1 Reminder Queue Foundation (shipped).

**Status:** Foundation complete — application version **v5.0.0-alpha.5**. Phases 1–6 implementation plus Phase 7 release-readiness gate. No live email sending.

**Release-readiness note (v5.0.0-alpha.5):**

- Template builder complete (`buildReminderEmailTemplate` — subject, bodyText, metadata, `emailMissing` flag)
- Queue template preview UI complete (per-row expandable preview with safety note)
- Copy template action complete (`buildReminderQueueTemplateCopyText` — clipboard copy for manual use)
- Digest builder complete (`buildReminderDigest` — manager/admin summary from queue items)
- Digest preview UI complete (subject, body, metadata counts, **Copy digest** button)
- Template & digest verification orchestrator complete (`npm run verify-reminder-template-digest-foundation`)
- **No delivery provider**
- **No send button**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

**Implementation phases (incremental):**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Template builder module (`js/app/automation/reminder-template-builder.js`) | **COMPLETE** |
| 1 | `buildReminderEmailTemplate` — subject, bodyText, metadata, `emailMissing` flag | **COMPLETE** |
| 1 | `npm run verify-reminder-template-builder` | **COMPLETE** |
| 2 | Queue template preview UI (`js/app/automation/reminder-queue-template-preview-ui.js`) | **COMPLETE** |
| 2 | Per-row “Preview template” expandable detail (subject, body, metadata, safety note) | **COMPLETE** |
| 2 | `npm run verify-reminder-queue-template-preview-ui` | **COMPLETE** |
| 3 | Copy template action (`buildReminderQueueTemplateCopyText`) — clipboard copy for manual email use | **COMPLETE** |
| 3 | Per-row **Copy template** button in expanded preview (`Subject:` + bodyText format) | **COMPLETE** |
| 3 | `npm run verify-reminder-template-copy` | **COMPLETE** |
| 4 | Digest builder module (`js/app/automation/reminder-digest-builder.js`) | **COMPLETE** |
| 4 | `buildReminderDigest` — subject, bodyText, metadata (counts + grouped queue summary) | **COMPLETE** |
| 4 | `npm run verify-reminder-digest-builder` | **COMPLETE** |
| 5 | Digest preview UI (`js/app/automation/reminder-digest-preview-ui.js`) | **COMPLETE** |
| 5 | Reminder Queue Preview digest area (subject, body, metadata counts, safety note) | **COMPLETE** |
| 5 | **Copy digest** button (`Subject:` + bodyText format) | **COMPLETE** |
| 5 | `npm run verify-reminder-digest-preview-ui` | **COMPLETE** |
| 6 | Foundation verification orchestrator (`scripts/verify-reminder-template-digest-foundation.mjs`) | **COMPLETE** |
| 6 | `npm run verify-reminder-template-digest-foundation` | **COMPLETE** |
| 7 | Release readiness / alpha tag prep (`v5.0.0-alpha.5`) | **COMPLETE** |

**Release candidate:** **v5.0.0-alpha.5**

**Release verification:** `npm run build` · `npm run verify-reminder-template-digest-foundation`

**Phase 1 reminder email template builder:**

`buildReminderEmailTemplate({ queueItem, organisationName, contactName })` generates reusable subject and body text from reminder queue items. Output includes `subject`, `bodyText`, `metadata` (queue source, reminder window, compliance type, expiry date), and `emailMissing` when no recipient email is on file. Missing-email queue items still produce preview content. Expired reminders use distinct renewal wording from upcoming expiry windows. **Template-only** — no email sending, mark-as-sent, compliance/action mutation, history writes, or fake links.

**Phase 2 reminder queue template preview UI:**

Each Reminder Queue Preview row includes a **Preview template** control. Expanding the row shows generated `subject` and `bodyText` (via `textContent`), metadata (reminder window, compliance type, expiry date, source), a missing-email warning when `emailMissing` is true, and the safety note: *Template preview only — no email is sent.* Wired to `buildReminderEmailTemplate` — **preview-only**; no send, execute, mark-sent, delivery provider, or history writes.

**Phase 3 copy reminder template:**

Each expanded template preview includes a **Copy template** button. Copies `Subject: <subject>` followed by a blank line and `bodyText` to the clipboard via `navigator.clipboard.writeText` when available. Shows *Template copied.* on success; shows a friendly copy-unavailable message when the clipboard API is not available. **Copy-only** — no send, execute, mark-sent, delivery provider, compliance/action mutation, or history writes.

**Phase 4 reminder digest builder:**

`buildReminderDigest({ queueItems, organisationName, asOfDate })` generates a manager/admin digest summarising who needs chasing from reminder queue items. Output includes `subject`, `bodyText`, and `metadata` (as-of date, organisation, total queued, missing email count, per-window counts, empty flag). The body lists summary counts (total queued, missing email, expired, 30/14/7-day) and a grouped follow-up list by reminder window/type with person name, compliance type, formatted expiry date, and email or “Missing email”. Empty queues return a useful “no reminders due” digest with zero counts. **Digest-only** — no email sending, mark-as-sent, compliance/action mutation, history writes, or delivery hooks.

**Phase 5 reminder digest preview UI:**

The Reminder Queue Preview section includes a **Digest preview** area wired to `buildReminderDigest` from the current queue preview items. It shows generated `subject` and `bodyText` (via `textContent`), summary metadata counts (total queued, missing email, expired, 30/14/7-day), the safety note: *Digest preview only — no email is sent.*, and a **Copy digest** button that copies `Subject: <subject>` followed by a blank line and `bodyText` to the clipboard when available. **Preview-only** — no send, execute, mark-sent, delivery provider, compliance/action mutation, or history writes.

**Phase 6 template and digest foundation verification:**

`npm run verify-reminder-template-digest-foundation` runs `verify-reminder-queue-foundation`, then V5-2 phases 1–5 verification scripts in order (template builder, template preview UI, copy template, digest builder, digest preview UI). Stops on first failure. Verification-only — no reminder/action/email execution, delivery provider integration, send functionality, mark-as-sent, or compliance/action/history mutation.

**Verification:** `npm run verify-reminder-template-digest-foundation` (master gate); individual phase scripts remain available for targeted checks (no Supabase).

**Constraints:** Template generation, preview, and digest generation only; no email delivery, mark-as-sent, compliance/action mutation, or history writes.

**Next slice:** V6 Phase 22 — Operations Log delivery UI + export — see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md).

---

## V6 — Reminder delivery · Phase 22 complete

**Goal:** Read-only Delivery Operations Log UI with summary counts, detail panel, and CSV export — audit delivery outcomes before any app send controls exist.

**Status:** Delivery Operations Log UI complete. V6 Phase 22 complete.

**Phase 22 deliverables:**

- **Delivery Operations Log** section in `index.html`
- `loadReminderDeliveryLogs()` via `get_reminder_delivery_logs` RPC
- Summary counts: total, delivered, failed, prepared/sending/cancelled
- Expandable detail panel (body text, metadata JSON, lifecycle timestamps via `textContent`)
- CSV export
- `npm run verify-delivery-operations-log-ui`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 22 | Delivery Operations Log UI + export | **Complete** |
| 23 | Worker delivery execution wiring | Planned |

**Verification:** `npm run verify-delivery-operations-log-ui` · `npm run verify-resend-provider-foundation`

**Constraints:** Read-only audit UI. No send button, delivery execution, mark-as-sent automation, or provider `sendReminder` calls.

**Next slice:** V6 Phase 24 — Worker delivery execution engine — see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md).

---

## V6 — Reminder delivery · Phase 24 complete

**Goal:** In-memory worker delivery execution engine that processes prepared records through an injected provider — isolated from app UI, scheduling, and mark-as-sent automation.

**Status:** Worker delivery execution engine complete. V6 Phase 24 complete.

**Phase 24 deliverables:**

- `executeReminderDeliveries({ records, provider, transitionRecord, now })` in `delivery-worker.js`
- Lifecycle: `prepared` → `sending` → `delivered` / `failed` via `transitionReminderDeliveryRecord`
- Skips delivered, cancelled, and `failed` + `missing_recipient_email`
- Summary: `total`, `attempted`, `delivered`, `failed`, `skipped`
- `npm run verify-delivery-worker`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 24 | Worker delivery execution engine (`executeReminderDeliveries`) | **Complete** |
| 25 | Delivery worker persistence adapter (`buildDeliveryLogPayloads`) | Planned |

**Verification:** `npm run verify-delivery-worker` · `npm run verify-resend-provider-foundation`

**Constraints:** Execution engine only. No `app.js` wiring, UI buttons, automatic scheduling, database writes, RPC calls, or mark-as-sent automation.

**Next slice:** V6 Phase 25 — Delivery worker persistence adapter — see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md).

---

## V6 — Reminder delivery · Phase 25 complete

**Goal:** Map delivery worker records/results to `create_reminder_delivery_log` RPC payloads without executing delivery or wiring into `app.js`.

**Status:** Delivery worker persistence adapter complete. V6 Phase 25 complete.

**Phase 25 deliverables:**

- `buildDeliveryLogPayloads({ records, organisationId, automationRunId })` in `delivery-worker-persistence.js`
- RPC payload fields: `p_organisation_id`, `p_automation_run_id`, `p_queue_item_id`, lifecycle timestamps, `p_metadata`, etc.
- Metadata preserves `providerMessageId`, `provider`, `failureType`, builder context, and `statusHistory`
- `npm run verify-delivery-worker-persistence`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 25 | Delivery worker persistence adapter (`buildDeliveryLogPayloads`) | **Complete** |
| 26 | Delivery log persistence service (`persistDeliveryLogPayloads`) | Planned |

**Verification:** `npm run verify-delivery-worker-persistence` · `npm run verify-delivery-worker`

**Constraints:** Persistence mapping only. No provider calls, RPC execution, database writes, `app.js` wiring, or mark-as-sent automation.

**Next slice:** V6 Phase 26 — Delivery log persistence service — see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md).

---

## V6 — Reminder delivery · Phase 26 complete

**Goal:** Persist delivery-log payloads through `create_reminder_delivery_log` RPC via an injected db adapter — without executing delivery or wiring into `app.js`.

**Status:** Delivery log persistence service complete. V6 Phase 26 complete.

**Phase 26 deliverables:**

- `persistDeliveryLogPayloads({ db, payloads })` in `delivery-log-persistence-service.js`
- `CloudAutomationStore.createReminderDeliveryLog(payload)` → `create_reminder_delivery_log` RPC
- Per-payload results; summary `{ total, persisted, failed }`; continues on partial failure
- `npm run verify-delivery-log-persistence-service`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 26 | Delivery log persistence service (`persistDeliveryLogPayloads`) | **Complete** |
| 27 | Delivery pipeline service (`runDeliveryPipeline`) | Planned |

**Verification:** `npm run verify-delivery-log-persistence-service` · `npm run verify-delivery-worker-persistence`

**Constraints:** Persistence service only. No provider calls, sending, `app.js` wiring, UI controls, or mark-as-sent automation.

**Next slice:** V6 Phase 27 — Delivery pipeline service.

---

## V6 — Reminder delivery · Phase 27 complete

**Goal:** Compose delivery execution, payload mapping, and log persistence into one pipeline service — without wiring into `app.js`, UI, schedules, or mark-as-sent automation.

**Status:** Delivery pipeline service complete. V6 Phase 27 complete.

**Phase 27 deliverables:**

- `runDeliveryPipeline({ records, provider, db, organisationId, automationRunId, now })` in `delivery-pipeline-service.js`
- Chains `executeReminderDeliveries` → `buildDeliveryLogPayloads` → `persistDeliveryLogPayloads`
- Returns `records`, `executionSummary`, `persistenceSummary`, `persistenceResults`
- `npm run verify-delivery-pipeline-service`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 27 | Delivery pipeline service (`runDeliveryPipeline`) | **Complete** |
| 28 | Delivery pipeline foundation verification (`verify-delivery-pipeline-foundation`) | Planned |

**Verification:** `npm run verify-delivery-pipeline-service` · `npm run verify-delivery-worker` · `npm run verify-delivery-worker-persistence` · `npm run verify-delivery-log-persistence-service`

**Constraints:** Service composition only. No `app.js` wiring, UI controls, scheduled jobs, or mark-as-sent automation.

**Next slice:** V6 Phase 28 — Delivery pipeline foundation verification.

---

## V6 — Reminder delivery · Phase 28 complete

**Goal:** One verification command proving the delivery pipeline stack works end-to-end at service level — without app/UI/schedule wiring.

**Status:** Delivery pipeline foundation verification complete. V6 Phase 28 complete.

**Phase 28 deliverables:**

- `scripts/verify-delivery-pipeline-foundation.mjs` orchestrator
- Runs: `verify-resend-provider-foundation`, `verify-delivery-worker`, `verify-delivery-worker-persistence`, `verify-delivery-log-persistence-service`, `verify-delivery-pipeline-service`, `verify-delivery-operations-log-ui`
- Stops on first failure; prints `V6 delivery pipeline foundation verification: OK`
- `npm run verify-delivery-pipeline-foundation`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 28 | Delivery pipeline foundation verification (`verify-delivery-pipeline-foundation`) | **Complete** |
| 29 | Worker delivery execution wiring | Planned |

**Verification:** `npm run verify-delivery-pipeline-foundation`

**Constraints:** Verification orchestrator only. No app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Next slice:** V6 Phase 29 — Delivery pipeline foundation release readiness.

---

## V6 — Reminder delivery · Phase 29 complete

**Goal:** Confirm the service-level delivery pipeline is safe to tag as **v6.0.0-alpha.7** before any app/UI/scheduled execution is added.

**Status:** Delivery pipeline foundation release readiness complete — application version **v6.0.0-alpha.7**. V6 Phases 1–29 complete.

**Release-readiness note (v6.0.0-alpha.7):**

- Delivery worker complete (`executeReminderDeliveries`)
- Persistence adapter complete (`buildDeliveryLogPayloads`)
- Persistence service complete (`persistDeliveryLogPayloads`)
- Delivery pipeline service complete (`runDeliveryPipeline`)
- Pipeline foundation verification complete (`verify-delivery-pipeline-foundation`)
- **No UI send button**
- **No scheduled execution**
- **No mark-as-sent automation**
- **No `app.js` pipeline wiring**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 29 | Delivery pipeline foundation release readiness (`v6.0.0-alpha.7`) | **Complete** |
| 30 | Manual delivery pipeline runner (`runManualDeliveryPipeline`) | Planned |

**Release candidate:** **v6.0.0-alpha.7**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-delivery-pipeline-foundation` — full delivery pipeline stack at service level

**Next slice:** V6 Phase 30 — Manual delivery pipeline runner.

---

## V6 — Reminder delivery · Phase 30 complete

**Goal:** Provide a manually invoked delivery pipeline runner for admins — the first end-to-end execution path without scheduling or automatic delivery.

**Status:** Manual delivery pipeline runner complete. V6 Phase 30 complete.

**Phase 30 deliverables:**

- `runManualDeliveryPipeline({ queueItems, provider, db, organisationId, automationRunId, organisationName, asOfDate, now })` in `manual-delivery-runner.js`
- Pipeline: `queueItems` → `buildReminderDeliveryRecords` → `runDeliveryPipeline`
- Returns `deliveryRecords`, `executionSummary`, `persistenceSummary`, `persistenceResults`
- `npm run verify-manual-delivery-runner`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 30 | Manual delivery pipeline runner (`runManualDeliveryPipeline`) | **Complete** |
| 31 | Manual delivery foundation verification (`verify-manual-delivery-foundation`) | Planned |

**Verification:** `npm run verify-manual-delivery-runner` · `npm run verify-delivery-pipeline-foundation`

**Constraints:** Service layer only. No scheduler, recurring automation, automatic delivery, `app.js` wiring, or mark-as-sent automation.

**Next slice:** V6 Phase 31 — Manual delivery runner verification orchestrator.

---

## V6 — Reminder delivery · Phase 31 complete

**Goal:** One verification command proving the manual delivery runner stack works without app/UI/scheduler wiring.

**Status:** Manual delivery foundation verification complete. V6 Phase 31 complete.

**Phase 31 deliverables:**

- `scripts/verify-manual-delivery-foundation.mjs` orchestrator
- Runs: `verify-delivery-pipeline-foundation`, `verify-manual-delivery-runner`
- Stops on first failure; prints `V6 manual delivery foundation verification: OK`
- `npm run verify-manual-delivery-foundation`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 31 | Manual delivery foundation verification (`verify-manual-delivery-foundation`) | **Complete** |
| 32 | Manual delivery foundation release readiness (`v6.0.0-alpha.8`) | **Complete** |

**Verification:** `npm run verify-manual-delivery-foundation`

**Constraints:** Verification orchestrator only. No app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Next slice:** V6 Phase 32 — Manual delivery foundation release readiness.

---

## V6 — Reminder delivery · Phase 32 complete

**Goal:** Confirm the manual delivery foundation is safe to tag as **v6.0.0-alpha.8** before any app/UI execution wiring.

**Status:** Manual delivery foundation release readiness complete — application version **v6.0.0-alpha.8**. V6 Phases 1–32 complete.

**Release-readiness note (v6.0.0-alpha.8):**

- Manual delivery pipeline runner complete (`runManualDeliveryPipeline`)
- Manual delivery foundation verification complete (`verify-manual-delivery-foundation`)
- **No UI send button**
- **No scheduled execution**
- **No mark-as-sent automation**
- **No `app.js` execution wiring**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 32 | Manual delivery foundation release readiness (`v6.0.0-alpha.8`) | **Complete** |
| 33 | Admin manual delivery UI (`Manual Delivery Test` card) | Planned |

**Release candidate:** **v6.0.0-alpha.8**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-manual-delivery-foundation` — full manual delivery stack at service level

**Next slice:** V6 Phase 33 — Admin manual delivery UI.

---

## V6 — Reminder delivery · Phase 33 complete

**Goal:** Provide an admin-only manual delivery execution UI — the first user-visible execution path.

**Status:** Admin manual delivery UI complete. V6 Phase 33 complete.

**Phase 33 deliverables:**

- **Manual Delivery Test** card (cloud mode + admin only)
- Queue summary and delivery mode display from provider config
- **Run Delivery Test** button with confirmation dialog
- Invokes `executeManualDeliveryTest` → `runManualDeliveryPipeline`
- Result summary: attempted, delivered, failed, persisted
- `npm run verify-manual-delivery-ui`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 33 | Admin manual delivery UI (`Manual Delivery Test` card) | **Complete** |
| 34 | Manual delivery E2E foundation verification (`verify-manual-delivery-e2e-foundation`) | Planned |

**Verification:** `npm run verify-manual-delivery-ui` · `npm run verify-manual-delivery-foundation`

**Constraints:** Manual execution only. No scheduling, automatic execution, mark-as-sent automation, or compliance/history mutation.

**Next slice:** V6 Phase 34 — Manual delivery UI end-to-end verification gate.

---

## V6 — Reminder delivery · Phase 34 complete

**Goal:** One verification command proving the manual delivery UI, provider foundation, delivery pipeline, and operations log work together safely.

**Status:** Manual delivery E2E foundation verification complete. V6 Phase 34 complete.

**Phase 34 deliverables:**

- `scripts/verify-manual-delivery-e2e-foundation.mjs` orchestrator
- Runs: `verify-manual-delivery-foundation`, `verify-resend-provider-foundation`, `verify-delivery-operations-log-ui`, `verify-manual-delivery-ui`
- Static safety checks: no committed API keys, admin/cloud-write run button gating
- Stops on first failure; prints `V6 manual delivery E2E foundation verification: OK`
- `npm run verify-manual-delivery-e2e-foundation`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 34 | Manual delivery E2E foundation verification (`verify-manual-delivery-e2e-foundation`) | **Complete** |
| 35 | Manual delivery E2E release readiness (`v6.0.0-beta.1`) | Planned |

**Verification:** `npm run verify-manual-delivery-e2e-foundation`

**Constraints:** Verification orchestrator only. No scheduled execution, automatic execution, mark-as-sent automation, or compliance/history mutation.

**Next slice:** V6.1 Phase 1 — Beta validation.

---

## V6.1 — Beta validation · Phase 1 complete

**Goal:** Validate the complete manual delivery workflow in a controlled staging environment before implementing mark-as-sent automation.

**Status:** Beta validation checklist and verification gate complete. V6.1 Phase 1 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `docs/v6-beta-validation.md` — ten test areas with automated + manual staging steps
- `scripts/verify-beta-validation-checklist.mjs` — checklist completeness + mapped automated scripts
- `npm run verify-beta-validation-checklist`

| Area | Automated coverage |
|------|-------------------|
| Queue generation | `verify-reminder-queue`, `verify-reminder-queue-ui` |
| Template / digest | `verify-reminder-template-builder`, `verify-reminder-digest-builder`, preview UI scripts |
| Manual delivery UI | `verify-manual-delivery-ui` |
| Test-mode delivery | `verify-resend-provider` |
| Real Resend send | `verify-manual-delivery-runner`, `verify-manual-delivery-foundation`, persistence + ops log |
| Missing email | `verify-reminder-delivery-record-builder` |
| Invalid email | `verify-resend-provider` (permanent failure mapping) |
| CSV export | `verify-delivery-operations-log-ui` |
| Permission checks | `verify-manual-delivery-ui`, `verify-manual-delivery-e2e-foundation` |
| Safety checks | `verify-manual-delivery-e2e-foundation`, `verify-manual-delivery-runner` |

**Constraints:** No new features, schema changes, RPC changes, or UI changes unless a bug is found. No mark-as-sent automation.

**Verification:** `npm run verify-beta-validation-checklist`

**Next slice:** V6 Phase 36 — Server-side delivery architecture plan — after manual staging sign-off.

---

## V6 — Reminder delivery · Phase 42 complete

**Goal:** Persist `send-reminder-deliveries` outcomes to `reminder_delivery_logs` after Edge Function delivery attempts — delivery log writes only.

**Status:** Edge Function delivery log persistence complete. V6 Phase 42 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `supabase/functions/send-reminder-deliveries/index.ts` — `persistDeliveryLog` → `create_reminder_delivery_log` per outcome
- `js/app/automation/manual-delivery-execution.js` — maps `persistenceSummary` from Edge Function `summary`
- `scripts/verify-edge-delivery-log-persistence.mjs` — persistence verification gate
- `npm run verify-edge-delivery-log-persistence`

| Item | Detail |
|------|--------|
| Outcomes | One row per record: delivered, failed (transient/permanent in metadata), skipped (`cancelled` + `outcomeStatus`) |
| RPC | Existing `create_reminder_delivery_log` — caller JWT, no service-role key in browser |
| Test mode | `metadata.redirectedToEmail`, `originalRecipientEmail`, `[TEST]` subject on audit row |
| Phase 42 scope | Delivery logs only — no mark-as-sent, compliance/history mutation, or scheduling |

**Constraints:** No mark-as-sent automation, no compliance/history mutation, no scheduled execution, no production mode changes.

**Verification:** `npm run verify-edge-delivery-log-persistence`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 42 | Delivery log persistence from Edge outcomes (`verify-edge-delivery-log-persistence`) | **Complete** |

**Next slice:** TBD — mark-as-sent automation or scheduled execution (out of Phase 42 scope).

---

## V6 — Reminder delivery · Phase 41 complete

**Goal:** Guide and verify the first safe staging deployment of `send-reminder-deliveries` with `EMAIL_MODE=test` — manual smoke checklist, inbox/Supabase checks, and automated smoke-plan gate.

**Status:** Test-mode deployment smoke test plan complete. V6 Phase 41 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- [`docs/v6-edge-delivery-test-deployment.md`](v6-edge-delivery-test-deployment.md) — Phase 41 manual smoke checklist, preflight commands, deploy steps, inbox checks
- `scripts/verify-edge-delivery-test-smoke-plan.mjs` — smoke plan verification gate
- `npm run verify-edge-delivery-test-smoke-plan`
- UI result summary — attempted / delivered / failed / skipped from Edge Function `summary`

| Item | Detail |
|------|--------|
| Preflight | `npm run build` + `verify-edge-delivery-test-deployment` + `verify-edge-delivery-test-smoke-plan` |
| Deploy | `supabase secrets set` + `supabase functions deploy send-reminder-deliveries` with `EMAIL_MODE=test` only |
| Manual smoke | Admin Manual Delivery Test → `/functions/v1/send-reminder-deliveries` → email at redirect inbox with `[TEST]` |
| Phase 41 scope | Smoke test support — no delivery logs, mark-as-sent, or production sends |

**Constraints:** No production sending, no delivery log RPC writes, no mark-as-sent automation, no scheduled execution, no compliance/history mutation.

**Verification:** `npm run verify-edge-delivery-test-smoke-plan`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 41 | Test-mode deployment smoke test (`verify-edge-delivery-test-smoke-plan`) | **Complete** |
| 42 | Delivery log persistence from Edge outcomes | Planned |

**Next slice:** Delivery log persistence from Edge Function outcomes (planned).

---

## V6 — Reminder delivery · Phase 40 complete

**Goal:** Prepare safe deployment and testing of `send-reminder-deliveries` in Supabase **test mode** — deployment checklist, secret checklist, smoke test plans, and automated readiness gate.

**Status:** Test-mode deployment readiness complete. V6 Phase 40 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- [`docs/v6-edge-delivery-test-deployment.md`](v6-edge-delivery-test-deployment.md) — deployment checklist, secrets, local/staging smoke tests, Supabase checks
- `scripts/verify-edge-delivery-test-deployment.mjs` — deployment readiness verification gate
- `npm run verify-edge-delivery-test-deployment`

| Item | Detail |
|------|--------|
| Required secrets | `RESEND_API_KEY`, `EMAIL_MODE=test`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO_ADDRESS`, `EMAIL_TEST_REDIRECT_TO`, `EMAIL_RATE_LIMIT_PER_RUN` |
| Test mode | All recipients redirect to `EMAIL_TEST_REDIRECT_TO`; `[TEST]` subject prefix |
| Missing secrets | `503` — `provider_not_configured`, `invalid_email_mode`, `invalid_config` |
| Browser path | Edge Function invoke only — no browser Resend |
| Phase 40 scope | Documentation + verification — no delivery logs, mark-as-sent, or production sends |

**Constraints:** No production sending, no delivery log RPC writes, no mark-as-sent automation, no scheduled execution, no compliance/history mutation.

**Verification:** `npm run verify-edge-delivery-test-deployment`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 40 | Test-mode deployment readiness (`verify-edge-delivery-test-deployment`) | **Complete** |
| 41 | Test-mode deployment smoke test (`verify-edge-delivery-test-smoke-plan`) | **Complete** |
| 42 | Delivery log persistence from Edge outcomes | Planned |

**Next slice:** Delivery log persistence from Edge Function outcomes (planned).

---

## V6 — Reminder delivery · Phase 39 complete

**Goal:** Wire Manual Delivery UI to invoke `send-reminder-deliveries` via authenticated Supabase session — no browser Resend fetch or `RESEND_API_KEY` exposure.

**Status:** Browser invoke wiring complete. V6 Phase 39 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `js/app/automation/edge-delivery-invoke.js` — `supabase.functions.invoke` client
- `js/app/automation/manual-delivery-execution.js` — Edge Function execution coordinator
- `scripts/verify-edge-delivery-browser-invoke.mjs` — browser invoke verification gate
- `npm run verify-edge-delivery-browser-invoke`

| Item | Detail |
|------|--------|
| Invoke payload | `organisationId`, `automationRunId`, `deliveryRecords` |
| Auth | Supabase session JWT via `getSupabaseClient()` |
| UI outcomes | `executionSummary` from Edge Function `summary` (`attempted`, `delivered`, `failed`, `skipped`) |
| Phase 39 scope | Browser invoke only — no delivery logs, no mark-as-sent, no scheduling |
| Legacy scaffold | `resend-provider.js` retained but not used by manual execution |

**Constraints:** No delivery log RPC writes, no mark-as-sent automation, no scheduled execution, no deploy of production Resend secrets yet.

**Verification:** `npm run verify-edge-delivery-browser-invoke`, `npm run verify-edge-delivery-resend`, and `npm run verify-edge-delivery-function-skeleton`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 39 | Browser invoke wiring (`verify-edge-delivery-browser-invoke`) | **Complete** |

**Next slice:** V6 Phase 40 — Edge Function test-mode deployment readiness.

---

## V6 — Reminder delivery · Phase 38 complete

**Goal:** Implement server-side Resend sending inside `send-reminder-deliveries` Edge Function with test/production gates, rate limiting, and failure mapping — no browser wiring.

**Status:** Edge Function Resend integration complete. V6 Phase 38 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `supabase/functions/send-reminder-deliveries/index.ts` — Resend `POST /emails` integration
- `scripts/verify-edge-delivery-resend.mjs` — Resend integration verification gate
- `npm run verify-edge-delivery-resend`

| Item | Detail |
|------|--------|
| Secrets | `RESEND_API_KEY`, `EMAIL_MODE`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO_ADDRESS`, `EMAIL_TEST_REDIRECT_TO`, `EMAIL_RATE_LIMIT_PER_RUN` |
| Test mode | Redirect to `EMAIL_TEST_REDIRECT_TO`; `[TEST]` subject prefix |
| Failure mapping | `2xx` delivered; `429`/`5xx` transient; `4xx` permanent |
| Phase 38 scope | Edge Function only — no delivery logs, no UI wiring; legacy browser path inert in git |
| Dual-path | Server Edge Function authoritative; browser scaffold disabled until sync-env |

**Constraints:** No browser invoke wiring, no delivery log RPC writes, no mark-as-sent automation, no scheduled execution. Legacy browser Resend scaffold retained but inert in committed defaults — see dual-path transition in `docs/v6-edge-delivery-function.md`.

**Verification:** `npm run verify-edge-delivery-resend` and `npm run verify-edge-delivery-function-skeleton`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 38 | Edge Function Resend integration (`verify-edge-delivery-resend`) | **Complete** |
| 39 | Browser invoke wiring (`verify-edge-delivery-browser-invoke`) | **Complete** |

**Next slice:** Delivery log persistence from Edge Function outcomes (planned).

---

## V6 — Reminder delivery · Phase 37 complete

**Goal:** Create the `send-reminder-deliveries` Edge Function skeleton with POST validation, OPTIONS CORS, and `not_implemented` response — no Resend calls or delivery log writes.

**Status:** Edge Function skeleton complete. V6 Phase 37 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `supabase/functions/send-reminder-deliveries/index.ts` — Deno Edge Function skeleton
- `scripts/verify-edge-delivery-function-skeleton.mjs` — skeleton verification gate
- `npm run verify-edge-delivery-function-skeleton`

| Item | Detail |
|------|--------|
| POST handler | Validates `Authorization`, `organisationId`, `automationRunId`, `deliveryRecords` |
| OPTIONS handler | CORS preflight for localhost origins |
| Response | `200` `{ status: "not_implemented", ... }` |
| Phase 37 scope | Skeleton only — no Resend, no delivery logs, no UI wiring |

**Constraints:** No Resend API calls, no `RESEND_API_KEY`, no delivery log writes, no mark-as-sent automation, no app UI changes.

**Verification:** `npm run verify-edge-delivery-function-skeleton` and `npm run verify-edge-delivery-plan`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 37 | Edge Function skeleton (`verify-edge-delivery-function-skeleton`) | **Complete** |
| 38 | Resend integration + browser invoke wiring | Planned |

**Next slice:** V6 Phase 38 — Edge Function Resend integration (see Phase 38 complete above).

---

## V6 — Reminder delivery · Phase 36 complete

**Goal:** Document the server-side delivery architecture before implementing Supabase Edge Function sends. Replace blocked browser → Resend path with browser → Edge Function → Resend → `create_reminder_delivery_log`.

**Status:** Server-side delivery architecture plan complete. V6 Phase 36 complete on **v6.0.0-beta.1** baseline.

**Deliverables:**

- `docs/v6-delivery-architecture.md` — Phase 36 section (CORS, API key exposure, new architecture)
- `docs/v6-edge-delivery-function.md` — `send-reminder-deliveries` contract
- `scripts/verify-edge-delivery-plan.mjs` — plan verification gate
- `npm run verify-edge-delivery-plan`

| Item | Detail |
|------|--------|
| CORS failure | Resend API blocks browser-origin requests — documented |
| API key exposure | `RESEND_API_KEY` must live only in Edge Function secrets |
| New path | Manual Delivery UI → Edge Function → Resend → delivery log RPC |
| Phase 36 scope | Planning only — no deployed function, no browser invoke wiring |

**Constraints:** No Edge Function deploy, no browser send-path changes, no live Resend calls, no mark-as-sent automation.

**Verification:** `npm run verify-edge-delivery-plan` and `npm run verify-manual-delivery-e2e-foundation`

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 36 | Server-side delivery architecture plan (`verify-edge-delivery-plan`) | **Complete** |
| 37 | Edge Function skeleton (`verify-edge-delivery-function-skeleton`) | **Complete** |
| 38 | Mark-as-sent on confirmed delivery (policy-gated) | Planned |

**Next slice:** V6 Phase 37 — Edge Function skeleton (see Phase 37 complete above).

---

## V6 — Reminder delivery · Phase 35 complete

**Goal:** Confirm the admin-only manual delivery UI and E2E safety gate are safe to tag as **v6.0.0-beta.1** before adding mark-as-sent automation.

**Status:** Manual delivery E2E release readiness complete — application version **v6.0.0-beta.1**. V6 Phases 1–35 complete.

**Release-readiness note (v6.0.0-beta.1):**

- Admin-only manual delivery UI complete (`Manual Delivery Test` card)
- Manual delivery E2E foundation verification complete (`verify-manual-delivery-e2e-foundation`)
- **No scheduled execution**
- **No automatic execution**
- **No mark-as-sent automation yet**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 35 | Manual delivery E2E release readiness (`v6.0.0-beta.1`) | **Complete** |
| 36 | Server-side delivery architecture plan (`verify-edge-delivery-plan`) | **Complete** |
| 37 | Edge Function skeleton (`verify-edge-delivery-function-skeleton`) | **Complete** |
| 38 | Mark-as-sent on confirmed delivery (policy-gated) | Planned |

**Release candidate:** **v6.0.0-beta.1**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-manual-delivery-e2e-foundation` — full manual delivery E2E foundation stack

**Next slice:** V6.1 Phase 1 — Beta validation.

---

## V6 — Reminder delivery · Phase 23 complete

**Goal:** Confirm the read-only Delivery Operations Log UI/export is safe to tag as **v6.0.0-alpha.6** before any delivery execution is wired into the app.

**Status:** Delivery Operations Log release readiness complete — application version **v6.0.0-alpha.6**. V6 Phases 1–23 complete.

**Release-readiness note (v6.0.0-alpha.6):**

- Delivery Operations Log UI complete (read-only audit view, summary counts, expandable detail panel)
- CSV export complete
- Loads via `get_reminder_delivery_logs` RPC (read-only)
- **No send/retry/execute controls**
- **No mark-as-sent automation**
- **No automatic delivery execution**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 23 | Delivery Operations Log release readiness (`v6.0.0-alpha.6`) | **Complete** |
| 24 | Worker delivery execution wiring | Planned |

**Release candidate:** **v6.0.0-alpha.6**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — Resend provider foundation still safe
- `npm run verify-delivery-operations-log-ui` — read-only audit UI and CSV export; no execution hooks

**Next slice:** V6 Phase 24 — Worker delivery execution wiring.

---

## V6 — Reminder delivery · Phase 21 complete

**Goal:** Confirm the isolated Resend provider implementation is safe to tag as **v6.0.0-alpha.5** before any app execution or worker wiring.

**Status:** Resend provider release readiness complete — application version **v6.0.0-alpha.5**. V6 Phases 1–21 complete.

**Release-readiness note (v6.0.0-alpha.5):**

- Delivery foundation complete (phases 1–9; see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md))
- Isolated Resend provider complete (`createResendEmailProvider` with injected `fetchImpl` only)
- Resend provider foundation verification orchestrator complete (`npm run verify-resend-provider-foundation`)
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- **Disabled-by-default provider mode**
- **No `app.js` wiring**
- **No UI send button**
- **No automatic delivery execution**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 21 | Resend provider release readiness (`v6.0.0-alpha.5`) | **Complete** |
| 22 | Operations Log delivery UI + export | Planned |

**Release candidate:** **v6.0.0-alpha.5**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — skeleton foundation + Resend plan + Resend provider orchestrator (no live execution)

**Next slice:** V6 Phase 22 — Operations Log delivery UI + export.

---

## V6 — Reminder delivery · Phase 20 complete

**Goal:** One verification command for provider skeleton foundation plus isolated Resend implementation, confirming it is still not wired into app execution.

**Status:** Resend provider foundation verification orchestrator complete. V6 Phase 20 complete.

**Phase 20 deliverables:**

- `scripts/verify-resend-provider-foundation.mjs` — runs skeleton foundation, Resend plan, and Resend provider verification in order
- `npm run verify-resend-provider-foundation` — master gate; stops on first failure

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 20 | Resend provider foundation verification orchestrator (`verify-resend-provider-foundation`) | **Complete** |
| 21 | Operations Log delivery UI + export | Planned |

**Verification:** `npm run verify-resend-provider-foundation`

**Constraints:** Verification orchestration only. No `app.js` wiring, UI send button, automatic delivery execution, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 21 — Operations Log delivery UI + export.

---

## V6 — Reminder delivery · Phase 19 complete

**Goal:** Implement the Resend provider adapter in isolation with injected `fetchImpl` — verified provider behaviour without UI send button or production automation path.

**Status:** Resend network implementation complete. V6 Phase 19 complete.

**Phase 19 deliverables:**

- `createResendEmailProvider({ config, fetchImpl })` in `js/app/automation/providers/resend-provider.js`
- Config validation (`disabled` / `invalid_config` / `ok` healthCheck)
- Test mode recipient redirect and `[TEST]` subject prefix
- HTTP failure mapping (transient/permanent)
- `npm run verify-resend-provider` — mocked `fetchImpl`; no live API calls

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 19 | Resend network implementation (`createResendEmailProvider`) | **Complete** |
| 20 | Operations Log delivery UI + export | Planned |

**Verification:** `npm run verify-resend-provider` · `npm run verify-email-provider-skeleton-foundation` · `npm run verify-resend-provider-plan`

**Constraints:** Provider module only. No `app.js` wiring, send button, mark-as-sent automation, compliance/action/history mutation, or automatic delivery execution.

**Next slice:** V6 Phase 20 — Operations Log delivery UI + export.

---

## V6 — Reminder delivery · Phase 18 complete

**Goal:** Confirm the Resend implementation plan is safe to tag as **v6.0.0-alpha.4** before any real network code is added.

**Status:** Resend plan release readiness complete — application version **v6.0.0-alpha.4**. V6 Phases 1–18 complete.

**Release-readiness note (v6.0.0-alpha.4):**

- Delivery foundation complete (phases 1–9; see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md))
- Resend implementation plan complete (Phase 17; env vars, validation, test/production gates, failure mapping, rate limits, audit, rollback)
- Resend plan verification complete (`npm run verify-resend-provider-plan`)
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider skeleton modules complete (Resend, SendGrid, SMTP) — `resend-provider.js` still skeleton
- Provider skeleton foundation verification orchestrator complete (`npm run verify-email-provider-skeleton-foundation`)
- **Disabled-by-default provider mode**
- **Mock provider only**
- **No Resend network implementation**
- **No API key usage**
- **No network calls**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 18 | Resend plan release readiness (`v6.0.0-alpha.4`) | **Complete** |
| 19 | Resend network implementation (`createResendEmailProvider`) | Planned |

**Release candidate:** **v6.0.0-alpha.4**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator (no live execution)
- `npm run verify-resend-provider-plan` — Resend plan documentation; skeleton-only provider module

**Next slice:** V6 Phase 19 — Resend network implementation.

---

## V6 — Reminder delivery · Phase 17 complete

**Goal:** Document the exact Resend implementation contract before writing network code.

**Status:** Resend implementation plan complete. Adds `npm run verify-resend-provider-plan`. Planning only — `resend-provider.js` remains skeleton.

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 17 | Resend implementation plan (documentation + verification) | **Complete** |
| 18 | Resend plan release readiness (`v6.0.0-alpha.4`) | **Complete** |

**Verification:** `npm run verify-resend-provider-plan`

**Next slice:** V6 Phase 19 — Resend network implementation.

---

## V6 — Reminder delivery · Phase 16 complete

**Goal:** Confirm provider config, adapter, skeleton modules, and delivery foundation are safe to tag as **v6.0.0-alpha.3** before any real provider network implementation.

**Status:** Provider skeleton release readiness complete — application version **v6.0.0-alpha.3**. V6 Phases 1–16 complete.

**Release-readiness note (v6.0.0-alpha.3):**

- Delivery foundation complete (phases 1–9; see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md))
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider skeleton modules complete (Resend, SendGrid, SMTP)
- Provider skeleton foundation verification orchestrator complete (`npm run verify-email-provider-skeleton-foundation`)
- **Disabled-by-default provider mode**
- **Mock provider only**
- **No real provider implementation**
- **No network calls**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 16 | Provider skeleton release readiness (`v6.0.0-alpha.3`) | **Complete** |
| 17 | Real provider network implementation | Planned |

**Release candidate:** **v6.0.0-alpha.3**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator (no live execution)

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 15 complete

**Goal:** Create one verification command proving provider config, adapter, skeleton modules, and delivery foundation all remain safe before real provider implementation.

**Status:** Provider skeleton foundation verification orchestrator complete.

**Deliverables:**

- `scripts/verify-email-provider-skeleton-foundation.mjs` — runs `verify-email-provider-foundation` and `verify-email-provider-skeletons` in order
- `npm run verify-email-provider-skeleton-foundation` — master gate for provider skeleton foundation

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 15 | Provider skeleton foundation verification orchestrator (`verify-email-provider-skeleton-foundation`) | **Complete** |
| 16 | Real provider network implementation | Planned |

**Verification:** `npm run verify-email-provider-skeleton-foundation`

**Constraints:** Verification orchestration only. No app behaviour changes. No real provider, network calls, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 14 complete

**Goal:** Add placeholder provider modules for future Resend, SendGrid, and SMTP integration without network calls, credentials, or real sending.

**Status:** Real provider skeleton modules complete. Adapter routes `resend`, `sendgrid`, and `smtp` to skeleton factories. Mock provider unchanged.

**Deliverables:**

- `js/app/automation/providers/resend-provider.js` — `createResendEmailProvider({ config })`
- `js/app/automation/providers/sendgrid-provider.js` — `createSendgridEmailProvider({ config })`
- `js/app/automation/providers/smtp-provider.js` — `createSmtpEmailProvider({ config })`
- `js/app/automation/email-provider-adapter.js` — routes enabled real providers to skeleton modules
- `npm run verify-email-provider-skeletons` — skeleton module and adapter routing verification gate

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 14 | Real provider skeleton modules (Resend, SendGrid, SMTP) | **Complete** |
| 15 | Provider skeleton foundation verification orchestrator | **Complete** |
| 16 | Real provider network implementation | Planned |

**Verification:** `npm run verify-email-provider-skeletons` · `npm run verify-email-provider-foundation`

**Constraints:** Skeleton only. No fetch, API keys, SDKs, SMTP transport, real sending, mark-as-sent automation, or `app.js` wiring.

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 13 complete

**Goal:** Confirm the provider configuration + adapter foundation is safe to tag as **v6.0.0-alpha.2** before any real provider implementation.

**Status:** Provider foundation release readiness complete — application version **v6.0.0-alpha.2**. V6 Phases 1–13 complete.

**Release-readiness note (v6.0.0-alpha.2):**

- Delivery foundation complete (phases 1–9; see [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md))
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider foundation verification orchestrator complete (`npm run verify-email-provider-foundation`)
- **Disabled-by-default provider mode**
- **Mock provider only**
- **No real provider implementation**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 13 | Provider foundation release readiness (`v6.0.0-alpha.2`) | **Complete** |
| 14 | Real provider implementation | Planned |

**Release candidate:** **v6.0.0-alpha.2**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-foundation` — phases 10–12 orchestrator (no live execution)

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 12 complete

**Goal:** Create one verification command for the provider configuration and adapter foundation before any real provider is implemented.

**Status:** Provider foundation verification orchestrator complete.

**Deliverables:**

- `scripts/verify-email-provider-foundation.mjs` — runs `verify-email-provider-config`, `verify-email-provider-adapter`, and `verify-delivery-foundation` in order
- `npm run verify-email-provider-foundation` — master gate for provider foundation

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 12 | Provider foundation verification orchestrator (`verify-email-provider-foundation`) | **Complete** |
| 13 | Real provider implementation | Planned |

**Verification:** `npm run verify-email-provider-foundation`

**Constraints:** Verification orchestration only. No app behaviour changes. No real provider, network calls, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 11 complete

**Goal:** Define a provider adapter contract and factory shape so real providers can be added later behind a safe interface — without implementing real delivery or wiring the application.

**Status:** Provider adapter interface complete. Full detail: [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md#provider-adapter-factory) · [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md).

**Deliverables:**

- `js/app/automation/email-provider-adapter.js` — `createEmailProviderAdapter({ config, mockProvider })` with disabled, mock, and not-implemented placeholder behaviour
- `npm run verify-email-provider-adapter` — adapter factory verification gate

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 11 | Provider adapter interface (`createEmailProviderAdapter`) | **Complete** |
| 12 | Real provider implementation | Planned |

**Verification:** `npm run verify-email-provider-adapter` · `npm run verify-email-provider-config` · `npm run verify-delivery-foundation`

**Constraints:** Interface/factory only. Not imported in `app.js`. No real provider, no network calls, no sending, no mark-as-sent automation, no compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 10 complete

**Goal:** Define how a real email provider will be configured safely — without implementing a provider, sending email, or wiring the application.

**Status:** Provider configuration architecture complete. Full detail: [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md).

**Deliverables:**

- `docs/v6-email-provider-configuration.md` — Resend/SendGrid/SMTP options, env vars, sender/reply-to rules, test vs production mode, rate limits, health checks, secrets, audit, GDPR
- `js/app/automation/email-provider-config.js` — `getEmailProviderConfig(env)` with safe defaults (`enabled: false`, `mode: disabled`, `provider: none`)
- `npm run verify-email-provider-config` — documentation, config module, and no-app-wiring gate

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 10 | Provider configuration architecture (`getEmailProviderConfig`) | **Complete** |
| 11 | Provider adapter interface (`createEmailProviderAdapter`) | **Complete** |
| 12 | Real provider implementation | Planned |

**Verification:** `npm run verify-email-provider-config` · `npm run verify-delivery-foundation`

**Constraints:** Configuration/design only. Not imported in `app.js`. No real provider, no sending, no mark-as-sent automation, no compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation.

---

## V6 — Reminder delivery · Phase 9 complete

**Goal:** Define the delivery domain model, build in-memory delivery records, establish the Postgres delivery log schema, add controlled delivery log RPCs, implement the in-process delivery state machine, add a mock email provider, execute mock delivery, verify the full delivery foundation, and ship the release-readiness gate — without real sending.

**Status:** Foundation complete — application version **v6.0.0-alpha.1**. Phases 1–8 implementation plus Phase 9 release-readiness gate. Mock provider only. Full architecture: [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md).

**Release-readiness note (v6.0.0-alpha.1):**

- Delivery domain model complete (lifecycle, record shape, audit, dedup, retry, `EmailProvider` interface)
- In-memory delivery record builder complete (`buildReminderDeliveryRecords`)
- `reminder_delivery_logs` schema + RLS complete
- Delivery log RPC draft complete (`create_reminder_delivery_log`, `get_reminder_delivery_logs`)
- In-process delivery state machine complete (`transitionReminderDeliveryRecord`)
- Mock email provider complete (`createMockEmailProvider`)
- Mock delivery executor complete (`executeMockReminderDelivery`)
- Delivery foundation verification orchestrator complete (`npm run verify-delivery-foundation`)
- **Mock provider only**
- **No real email provider**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery lifecycle, record shape, audit, dedup, retry, `EmailProvider` interface | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Mock delivery executor (`executeMockReminderDelivery`) | **Complete** |
| 8 | Delivery foundation verification orchestrator (`verify-delivery-foundation`) | **Complete** |
| 9 | Release readiness / alpha tag prep (`v6.0.0-alpha.1`) | **Complete** |
| 10 | Provider configuration architecture (`getEmailProviderConfig`) | **Complete** |
| 11 | Real email provider adapter | Planned |

**Release candidate:** **v6.0.0-alpha.1**

**Phase 8 foundation verification orchestrator:**

`npm run verify-delivery-foundation` runs phases 1–7 verification scripts in order (architecture, record builder, schema, RPCs, state machine, mock provider, mock executor). Stops on first failure. Verification-only — no real email provider, production delivery, mark-as-sent automation, or compliance/action/history mutation.

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-delivery-foundation` — phases 1–8 orchestrator (no live execution)

**Verification:** `npm run verify-delivery-foundation` (master gate); individual phase scripts remain available for targeted checks.

**Constraints:** Mock provider only. No real email provider, no production delivery, no mark-as-sent automation, no app wiring, no compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation.

### V6 Phase 2 — Delivery record builder

**Module:** `js/app/automation/reminder-delivery-record-builder.js`

`buildReminderDeliveryRecords({ queueItems, organisationId, automationRunId, organisationName, asOfDate })` creates in-memory delivery records from reminder queue items. Each record includes `id`, org/run linkage, `queueItemId`, `recipientEmail`, template `subject`/`bodyText`, lifecycle timestamps, and `metadata` (reminder window, compliance type, expiry date, source, `emailMissing`). Items with a valid email receive `deliveryStatus: "prepared"`; missing-email items still produce a record with template content but `deliveryStatus: "failed"`, `failureReason: "missing_recipient_email"`, and `recipientEmail: null`. Input queue items are not mutated. **Record preparation only** — no email provider, delivery, mark-as-sent, or database writes.

### V6 Phase 3 — Delivery log schema

**Migration:** `supabase/migrations/20260401000006_create_reminder_delivery_logs.sql`

**Table:** `public.reminder_delivery_logs` — per-recipient delivery audit rows with lifecycle timestamps, `metadata` (including `reminderWindow` for dedup), org/run/queue linkage, and `delivery_status` constrained to `queued`, `prepared`, `sending`, `delivered`, `failed`, or `cancelled`.

**Dedup index:** partial unique index on `(organisation_id, compliance_record_id, metadata->>'reminderWindow', prepared_at::date)` where `compliance_record_id is not null`.

**RLS:** `admin`/`editor` select; `admin` insert/update; no delete policy yet. `updated_at` via shared `set_updated_at()` trigger.

**Schema only** — no RPCs, no cloud store wiring, no UI, no provider, no mark-as-sent automation.

### V6 Phase 4 — Delivery log RPC draft

**Migration:** `supabase/migrations/20260401000007_reminder_delivery_log_rpcs.sql`

**RPCs:**

- `public.create_reminder_delivery_log(...)` — admin-only insert into `reminder_delivery_logs`; validates lifecycle `delivery_status`; returns `{ id, delivery_status, created_at }`; no email sending or compliance/action/history mutation
- `public.get_reminder_delivery_logs(p_organisation_id uuid)` — admin/editor read; viewer denied; returns logs ordered by `created_at desc`

**RPC draft only** — no cloud store wiring, no UI, no provider, no mark-as-sent automation.

### V6 Phase 5 — Delivery state machine

**Module:** `js/app/automation/reminder-delivery-state-machine.js`

`transitionReminderDeliveryRecord({ record, nextStatus, reason, at })` applies validated in-memory lifecycle transitions. Returns a new record; input is not mutated. Sets timestamp fields per target status (`preparedAt`, `sentAt`, `deliveredAt`, `failedAt`/`failureReason`, `cancelledAt`/`cancellationReason`) and appends `statusHistory` audit entries. Terminal states (`delivered`, `cancelled`) reject further transitions; invalid transitions throw.

**State logic only** — no email provider, delivery, mark-as-sent, or database writes.

### V6 Phase 6 — Mock email provider

**Module:** `js/app/automation/mock-email-provider.js`

`createMockEmailProvider({ mode })` returns a simulated provider with `sendReminder({ to, subject, bodyText, metadata })` and `healthCheck()`. Modes: `success` (returns `delivered` with `providerMessageId` and `deliveredAt`), `transient_failure`, and `permanent_failure` (returns `failed` with `failureType` and `failureReason`). `healthCheck()` returns `{ status: "ok", provider: "mock" }`.

**Mock provider only** — no real email provider, no `fetch`/SMTP/external APIs, no delivery execution, mark-as-sent, or compliance/action/history mutation.

### V6 Phase 7 — Mock delivery executor

**Module:** `js/app/automation/mock-delivery-executor.js`

`executeMockReminderDelivery({ records, provider, at })` processes prepared delivery records using a mock email provider only. For each `prepared` record: transitions to `sending`, calls `provider.sendReminder()`, then transitions to `delivered` or `failed` based on provider outcome. Skips records already `delivered`/`cancelled`, `failed` with `missing_recipient_email`, or non-`prepared` states. Uses `transitionReminderDeliveryRecord()` from the state machine. Returns updated records and a summary (`total`, `attempted`, `delivered`, `failed`, `skipped`). Input records are not mutated.

**Mock execution only** — no real email provider, no production delivery, no `fetch`/SMTP/external APIs, no mark-as-sent, or compliance/action/history mutation.

---

### V5-2A — Automated action orchestration

**Goal:** Provision and advance actions based on compliance state, not manual clicks.

| ID | Deliverable | Notes |
|----|-------------|-------|
| V5-2A | Policy type `auto_default_actions` | When record enters `expiring` / `expired` / `missing_evidence`, call existing `add_default_actions` RPC |
| V5-2B | Policy type `auto_action_from_recommendation` | Map V4 recommendation ids → action templates (reuse `recommendations-engine.js` ids) |
| V5-2C | De-duplication rules | Skip if action title already exists (parity with local `addDefaultActionsLocal`) |
| V5-2D | RPC `apply_automation_policies` | Called by daily scan; returns applied/skipped counts per policy |
| V5-2E | Automation Settings UI — Actions tab | Toggle per policy; preview affected count (dry-run) |
| V5-2F | History attribution | `action_added` entries note automation policy name + run id |
| V5-2G | Verify: `verify-automation-actions` | Fixture rows → policy apply → action rows + history |

**User story:** *When a DBS record expires, the system automatically creates “Request renewed DBS” and “Upload evidence” actions if they do not already exist.*

---

### V5-3 — Escalation & operational closure

**Goal:** Close the loop on V4 operational health — missing reminder follow-up triggers escalation.

| ID | Deliverable | Notes |
|----|-------------|-------|
| V5-3A | Policy type `escalation` | Conditions: e.g. expired + missing follow-up after N days, overdue action + no owner |
| V5-3B | Escalation actions | Notify admin role; create high-priority action; optional second digest |
| V5-3C | `escalation_events` table | Immutable audit of what fired, when, for whom |
| V5-3D | Dashboard tile — Automation Health | Counts: policies active, runs 7d, failures, escalations open |
| V5-3E | Compliance Insights integration | New read-only tile: “Automations active” + link to operations log |
| V5-3F | Verify: `verify-automation-escalation` | Seed gap → scan → escalation event + notification |

**User story:** *If a reminder was due 7 days ago and no follow-up was recorded, the diocesan admin receives an escalation email.*

---

### V5-4 — Policy engine GA & operations pack

**Goal:** Production-ready automation with export, GDPR alignment, and release gate.

| ID | Deliverable | Notes |
|----|-------------|-------|
| V5-4A | Policy templates library | Presets: “Standard safeguarding”, “Volunteer onboarding”, “DBS renewal” |
| V5-4B | Policy dry-run RPC | `preview_automation_policy` — no writes; returns affected records |
| V5-4C | Operations export pack | CSV: runs, deliveries, escalations (mirrors V4 insights export pattern) |
| V5-4D | GDPR / retention | Delivery log retention setting; export/delete automation logs per org |
| V5-4E | Production cloud-writes + automation policy doc | Extends v3.1 GDPR checklist |
| V5-4F | `npm run verify:automation` | Full chain: schema → reminders → actions → escalation → build |
| V5-4G | Browser acceptance checklist | `docs/v5-browser-acceptance.md` |
| V5-4H | Version bump to **v5.0.0** | ROADMAP + release notes |

**Exit criteria:** `verify:automation` + `verify:phase2` + `verify-insights-release` all pass on staging.

---

## Policy document schema (draft)

Stored in `automation_policies.policy` (JSONB). Validated server-side.

```json
{
  "version": 1,
  "name": "Standard safeguarding reminders",
  "enabled": true,
  "triggers": [
    {
      "type": "reminder_window",
      "windows": [30, 14, 7],
      "channels": ["email_digest"],
      "markSentOnDelivery": true
    },
    {
      "type": "record_state",
      "when": "expired",
      "actions": ["add_default_actions"],
      "templates": ["Request renewed DBS", "Upload evidence"]
    },
    {
      "type": "recommendation",
      "recommendationId": "expired-records-critical",
      "actions": ["notify_role"],
      "role": "admin"
    },
    {
      "type": "escalation",
      "condition": "missing_reminder_followup",
      "afterDays": 7,
      "actions": ["notify_role", "create_action"],
      "actionTitle": "Escalation: overdue reminder follow-up"
    }
  ],
  "schedule": {
    "scanCron": "0 6 * * *",
    "digestCron": "0 8 * * 1",
    "timezone": "Europe/London"
  }
}
```

---

## Dependencies & sequencing

| Prerequisite | Why |
|--------------|-----|
| **v4.0.1 GA** | Recommendations engine and operational health metrics are automation inputs |
| **v3.1.0 evidence Storage** | Auto-actions referencing evidence upload need real file path support |
| **v3.1.0 restore/bulk ops** | Automation may archive stale records; restore needed for corrections |
| **Production email provider** | Reminder delivery is core v5 value |
| **Cloud writes GA policy** | Automation is cloud-only; production write policy must be signed off |

**Suggested timeline (indicative):**

| Phase | Slices | Estimate |
|-------|--------|----------|
| Foundation | V5-0 | 2–3 weeks |
| Reminders | V5-1 | 3–4 weeks |
| Actions | V5-2 | 2–3 weeks |
| Escalation | V5-3 | 2 weeks |
| GA hardening | V5-4 | 2 weeks |

Total: **~12–14 weeks** after v4.0.1 tag (assumes v3.1.0 overlap on Storage/import).

---

## Verification strategy

Extend the existing pattern from V3/V4:

| Command | Scope |
|---------|-------|
| `npm run verify-contact-management` | V5-1A alpha gate — contact CSV/workspace + insights release chain |
| `npm run verify-reminder-template-preview` | V5-1B Phase 1 — template module, output shape, no delivery hooks |
| `npm run verify-reminder-template-preview-ui` | V5-1B Phase 2 — preview modal, Action Required/workspace wiring, no delivery hooks |
| `npm run verify-reminder-template-preview-actions` | V5-1B Phase 3 — copy/export actions, full email text, no delivery hooks |
| `npm run verify-automation-foundation` | V5-0 Phase 1 — schema tables + feature flag |
| `npm run verify-automation-policies` | V5-0 Phase 2 — policy admin RPCs |
| `npm run verify-automation-runs` | V5-0 Phase 3 — run read RPCs |
| `npm run verify-automation-run-create` | V5-0 Phase 4 — create run RPC |
| `npm run verify-automation-dry-run` | V5-0 Phase 5 — dry-run scan engine, no execution hooks |
| `npm run verify-automation-dry-run-logging` | V5-0 Phase 6 — dry-run audit logging only, no execution |
| `npm run verify-automation-run-ui` | V5-0 Phase 7 — read-only automation audit UI, no execution hooks |
| `npm run verify-automation-v5-foundation` | V5-0 Phase 8 — orchestrator; runs phases 1–7 in order, stop on first failure |
| `npm run verify-reminder-queue` | V5-1 Phase 1 — in-memory reminder queue from dry-run, no delivery hooks |
| `npm run verify-reminder-queue-ui` | V5-1 Phase 2 — read-only reminder queue preview UI, no execution hooks |
| `npm run verify-reminder-queue-export` | V5-1 Phase 3 — reminder queue preview CSV export, no execution or mutation hooks |
| `npm run verify-reminder-queue-foundation` | V5-1 Phase 4 — orchestrator; runs V5-0 foundation + phases 1–3 in order, stop on first failure |
| `npm run verify-reminder-template-builder` | V5-2 Phase 1 — queue-item email template builder, no delivery hooks |
| `npm run verify-reminder-queue-template-preview-ui` | V5-2 Phase 2 — queue template preview UI, safe rendering, no execution hooks |
| `npm run verify-reminder-template-copy` | V5-2 Phase 3 — queue template copy action, clipboard path, no execution hooks |
| `npm run verify-reminder-digest-builder` | V5-2 Phase 4 — manager/admin reminder digest builder, no delivery hooks |
| `npm run verify-reminder-digest-preview-ui` | V5-2 Phase 5 — digest preview UI, safe rendering, no execution hooks |
| `npm run verify-reminder-template-digest-foundation` | V5-2 Phase 6 — orchestrator; runs V5-1 queue foundation + V5-2 phases 1–5 in order, stop on first failure |
| `npm run verify-delivery-architecture` | V6 Phase 1 — delivery domain model architecture doc, lifecycle, record fields, provider abstraction |
| `npm run verify-reminder-delivery-record-builder` | V6 Phase 2 — in-memory delivery record builder from queue fixtures |
| `npm run verify-reminder-delivery-log-schema` | V6 Phase 3 — `reminder_delivery_logs` migration, columns, constraints, RLS, no app wiring |
| `npm run verify-reminder-delivery-log-rpcs` | V6 Phase 4 — delivery log create/read RPC migration, role gates, no app wiring |
| `npm run verify-reminder-delivery-state-machine` | V6 Phase 5 — in-memory delivery state transitions, timestamps, terminal states |
| `npm run verify-mock-email-provider` | V6 Phase 6 — mock provider adapter, success/failure modes, no external network |
| `npm run verify-mock-delivery-executor` | V6 Phase 7 — mock delivery executor, lifecycle transitions, skip rules, summary counts |
| `npm run verify-delivery-foundation` | V6 Phase 8 — orchestrator; runs phases 1–7 in order, stop on first failure |
| `npm run verify-email-provider-config` | V6 Phase 10 — provider config documentation, config module, safe defaults, no app wiring |
| `npm run verify-email-provider-adapter` | V6 Phase 11 — adapter factory, disabled/mock/placeholder behaviour, no app wiring |
| `npm run verify-email-provider-foundation` | V6 Phase 12 — orchestrator; runs phases 10–11 + delivery foundation in order, stop on first failure |
| `npm run verify-email-provider-skeletons` | V6 Phase 14 — skeleton provider modules, adapter routing, no network/SDK hooks, no app wiring |
| `npm run verify-email-provider-skeleton-foundation` | V6 Phase 15 — orchestrator; runs phases 12 + 14 in order, stop on first failure |
| `npm run verify-resend-provider-plan` | V6 Phase 17 — Resend implementation plan documentation |
| `npm run verify-resend-provider` | V6 Phase 19 — Resend provider network implementation (mocked `fetchImpl`; no app wiring) |
| `npm run verify-resend-provider-foundation` | V6 Phase 20 — orchestrator; runs skeleton foundation + Resend plan + Resend provider in order, stop on first failure |
| `npm run verify-delivery-operations-log-ui` | V6 Phase 22 — Delivery Operations Log UI, CSV export, no execution hooks |
| `npm run verify-delivery-worker` | V6 Phase 24 — worker delivery execution engine (in-memory; no app wiring) |
| `npm run verify-delivery-worker-persistence` | V6 Phase 25 — worker persistence adapter (RPC payload mapping; no RPC calls) |
| `npm run verify-delivery-log-persistence-service` | V6 Phase 26 — delivery log persistence service (RPC orchestration; no app wiring) |
| `npm run verify-delivery-pipeline-service` | V6 Phase 27 — delivery pipeline service (execution + persistence composition; no app wiring) |
| `npm run verify-delivery-pipeline-foundation` | V6 Phase 28 — delivery pipeline foundation orchestrator (full service-level stack) |
| `npm run verify-manual-delivery-runner` | V6 Phase 30 — manual delivery pipeline runner (queue → pipeline; no scheduler/app wiring) |
| `npm run verify-manual-delivery-foundation` | V6 Phase 31 — manual delivery foundation orchestrator (pipeline + manual runner stack) |
| `npm run verify-manual-delivery-ui` | V6 Phase 33 — admin manual delivery test UI (confirmation + manual runner wiring) |
| `npm run verify-manual-delivery-e2e-foundation` | V6 Phase 34 — manual delivery E2E foundation orchestrator (UI + provider + pipeline + ops log) |
| `npm run verify-beta-validation-checklist` | V6.1 Phase 1 — beta validation checklist completeness + automated test-area scripts |
| `npm run verify-automation-schema` | V5-0 migrations + RPC |
| `npm run verify-automation-reminders` | V5-1 queue + mark sent |
| `npm run verify-automation-actions` | V5-2 policy apply |
| `npm run verify-automation-escalation` | V5-3 escalation path |
| `npm run verify:automation` | Full V5 chain + build |
| `npm run verify:phase2` | Regression — all V3 cloud RPC smokes still pass |
| `npm run verify-insights-release` | Regression — insights unchanged |

Staging reset script (`reset-alpha-staging-data.mjs`) gains seed policies and a fixture record in each reminder window.

---

## UI surfaces (new in v5)

| Surface | Location | Audience |
|---------|----------|----------|
| **Automation Settings** | Settings panel (admin) | Configure policies, schedules, recipients |
| **Operations Log** | Dashboard section | View runs, deliveries, failures |
| **Automation Health** | Compliance Insights adjacent | Summary tile + drilldown |
| **Policy dry-run preview** | Modal from settings | Admin tests before enable |
| **Local mode banner** | Settings | “Automation requires cloud backend” |

No change to register CRUD or workspace layout beyond optional “Created by automation” badges on actions.

---

## Security & permissions

| Capability | Admin | Editor | Viewer |
|------------|-------|--------|--------|
| View automation runs / delivery log | ✓ | ✓ | ✓ |
| Configure policies | ✓ | — | — |
| Receive digest emails | ✓ | ✓ (configurable) | optional |
| Trigger manual dry-run | ✓ | — | — |
| Disable automation org-wide | ✓ | — | — |

Automation RPCs use `security definer` with org membership checks, consistent with existing Phase 3 RPCs.

Secrets (SMTP API keys) live in Supabase Edge Function secrets only — never in client bundle.

---

## Success metrics

| Metric | Target (90 days post-GA) |
|--------|--------------------------|
| Reminder follow-up gap (V4 operational health) | ↓ 40% for orgs with automation enabled |
| Manual “mark reminder sent” actions | ↓ 60% vs baseline |
| Time to first action on new expired record | < 24 hours (automated create) |
| Automation run success rate | ≥ 99% daily scans |
| Zero unauthorised cross-org automation | Enforced by RLS + RPC tests |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Email deliverability / spam | Verified sender domain; plain-text + HTML; unsubscribe per org |
| Over-automation (action spam) | De-duplication; dry-run; policy enable is opt-in per org |
| Clock/timezone drift | Explicit org timezone in policy; UTC storage |
| Local mode parity expectations | Clear docs: automation is cloud value-add, local stays manual |
| Edge Function cost at scale | Batch queue processing; rate limits per org |

---

## Out of scope → v5.x / v6 candidates

- SMS / Slack / Microsoft Teams notifications
- Per-person notification preferences
- Visual workflow builder (drag-and-drop)
- AI-generated reminder copy
- Cross-organisation diocesan rollup automation
- Webhook integrations (Zapier, Power Automate)

---

## Documentation deliverables

| Document | When |
|----------|------|
| `docs/v5-automated-compliance-operations.md` | This roadmap (v5 planning) |
| `docs/v6-delivery-architecture.md` | V6 — delivery domain model + Phase 2 record builder |
| `docs/v5-1a-contact-management.md` | V5-1A alpha — contact fields, verification, browser checklist |
| `docs/automation-setup.md` | V5-0 — cron, secrets, feature flags |
| `docs/automation-policies.md` | V5-2 — policy schema reference |
| `docs/v5-release-notes.md` | V5-4 GA |
| `docs/v5-browser-acceptance.md` | V5-4 manual QA |

---

## Slice status tracker

| Slice | Status | Summary |
|-------|--------|---------|
| V5-1A | **COMPLETE** | Contact Management — email fields, insights, drilldown-to-edit; **v5.0.0-alpha.1** |
| V5-1B | **COMPLETE** | Reminder Template Preview — template, UI, copy/export, dashboard; **v5.0.0-alpha.2** |
| V5-0 | **COMPLETE** | Automation platform foundation — schema, RPCs, dry-run scan + audit logging + audit UI; **v5.0.0-alpha.3** |
| V5-1 (foundation) | **COMPLETE** | Reminder queue foundation — queue, preview UI, CSV export, orchestrator; **v5.0.0-alpha.4** |
| V5-2 | **COMPLETE** | Reminder email template builder — template builder, preview UI, copy template, digest builder, digest preview UI, foundation orchestrator; **v5.0.0-alpha.5**; no delivery |
| V6-1 | **COMPLETE** | Delivery pipeline foundation — domain model through delivery pipeline foundation release readiness; **v6.0.0-alpha.7**; service-level worker, persistence adapter, persistence service, pipeline service, foundation verification; no UI send button, scheduled execution, or mark-as-sent automation |
| V6-2 | **COMPLETE** | Manual delivery foundation — manual runner, foundation verification, release readiness; **v6.0.0-alpha.8**; no UI send button, scheduled execution, mark-as-sent automation, or `app.js` execution wiring |
| V6-3 | **COMPLETE** | Manual delivery E2E — admin UI, E2E verification gate, release readiness; **v6.0.0-beta.1**; no scheduled execution, automatic execution, or mark-as-sent automation yet |
| V5-2A | **PLANNED** | Automated action orchestration |
| V5-3 | **PLANNED** | Escalation & operational closure |
| V5-4 | **PLANNED** | Policy engine GA & operations pack |

**Constraints (v5 planning):** Builds on RPC-only writes. No AI/LLM. Automation disabled in local mode. Email provider required for full reminder value.

**Tag target:** `v5.0.0`
