# v5.0.0 — Automated Compliance Operations

**Theme:** Move from *knowing* what needs attention (V4 Compliance Insights) to *acting on it automatically* — scheduled reminders, orchestrated actions, escalations, and auditable operations.

**Target:** v5.0.0 (major release)  
**Current alpha:** v5.0.0-alpha.2 — V5-1A Contact Management + V5-1B Reminder Template Preview (see [`docs/v5-0-0-alpha-2-release-notes.md`](v5-0-0-alpha-2-release-notes.md))  
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

Slices are ordered **V5-1A (contact foundation) → V5-1B (preview) → V5-0 → V5-1 automation → V5-2 → V5-4**. Contact Management shipped as **v5.0.0-alpha.1**; Reminder Template Preview as **v5.0.0-alpha.2**; server automation follows with **V5-0**.

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

### V5-0 — Automation platform foundation

**Goal:** Schema, RPC contracts, and run infrastructure without user-visible automation yet.

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

### V5-1 — Automated reminders & digests

**Goal:** Replace manual “who needs a reminder today?” with scheduled identification and delivery.

**Prerequisite slices:** V5-1A Contact Management (shipped), V5-1B Reminder Template Preview (planned), V5-0 automation platform.

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

### V5-2 — Automated action orchestration

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
| V5-0 | **PLANNED** | Automation platform foundation |
| V5-1 (automation) | **PLANNED** | Automated reminders & digests (post V5-0) |
| V5-2 | **PLANNED** | Automated action orchestration |
| V5-3 | **PLANNED** | Escalation & operational closure |
| V5-4 | **PLANNED** | Policy engine GA & operations pack |

**Constraints (v5 planning):** Builds on RPC-only writes. No AI/LLM. Automation disabled in local mode. Email provider required for full reminder value.

**Tag target:** `v5.0.0`
