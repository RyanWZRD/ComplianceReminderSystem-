# v5.0.0-alpha.2 release notes and checklist

**Release:** v5.0.0-alpha.2 — V5-1A Contact Management + V5-1B Reminder Template Preview  
**Base:** v5.0.0-alpha.1 (V5-1A Contact Management)  
**Date:** June 2026  
**Scope:** Documentation and verification only in V5-1B Phase 5 — no new product functionality, CRUD changes, cloud/RPC changes, migrations, permissions changes, or insight calculation changes.

---

## Summary

**v5.0.0-alpha.2** is the second v5 alpha checkpoint. It combines **V5-1A Contact Management** (person email fields, Contact Readiness insights, drilldown-to-edit) with **V5-1B Reminder Template Preview** (Phases 1–4: read-only template generation, preview modal, copy/export utilities, and operational preview dashboard). Teams can preview reminder copy and recipient context before any delivery infrastructure exists.

Application version in source: **v5.0.0-alpha.2**.

**Next planned slice:** [V5-0 — Automation Platform Foundation](#next-planned-slice-v5-0-automation-platform-foundation).

---

## What this alpha includes

### V5-1A — Contact Management (v5.0.0-alpha.1)

Full checklist: [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md).

| Area | Deliverable |
|------|-------------|
| Data | Optional person **email** and **manager email** (local + cloud) |
| UI | Add/edit forms, register Email column, workspace Contact Information |
| CSV | Import/export contact columns (local mode) |
| Insights | Contact Readiness metrics, drilldowns, recommendations, export |
| Workflow | Drilldown **Edit Contact** → edit form with email focus |

### V5-1B — Reminder Template Preview (Phases 1–4)

Full checklist: [`docs/v5-1b-reminder-template-preview.md`](v5-1b-reminder-template-preview.md).

| Phase | Deliverable |
|-------|-------------|
| 1 | Template module — subject/body for 30/14/7-day and expired windows |
| 2 | Preview modal — Action Required and workspace **Preview Reminder Email** |
| 3 | Copy subject/body/full email + export single preview `.txt` |
| 4 | Reminder Preview Dashboard — card counts, drilldown table, **Export Reminder Pack** |
| 5 | Alpha release gate — docs, `verify-reminder-suite`, version bump (this checkpoint) |

**Shared constraints (V5-1A + V5-1B):** No email delivery, notification queue, automation, Edge Functions, new migrations, RPC changes, or permission changes in this alpha.

---

## Verification commands (required before tag)

Run from repository root. All gates below should pass before tagging **v5.0.0-alpha.2**.

### 1. V5-1B reminder preview suite (no Supabase required)

```powershell
npm run verify-reminder-suite
```

Runs in order:

1. `verify-reminder-template-preview` — template module output shape and fixtures
2. `verify-reminder-template-preview-ui` — modal markup, Action Required and workspace wiring
3. `verify-reminder-template-preview-actions` — copy/export helpers and modal actions
4. `verify-reminder-preview-dashboard` — dashboard metrics, drilldown, export pack

### 2. V5-1A contact management gate (no Supabase required)

```powershell
npm run verify-contact-management
```

Runs contact CSV/workspace checks plus Compliance Insights release chain and terminology regression. See [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md).

### 3. Compliance Insights release chain (subset of contact gate)

```powershell
npm run verify-insights-release
```

Insights engine, browser smoke, build, and RC terminology checks.

### 4. Cloud release gate (requires `.env` + staging Supabase)

```powershell
npm run verify:phase2
```

Includes V5-1A cloud contact smokes, full Phase 2 + Phase 3 RPC regression, insights engine, build, and terminology gates. **No V5-1B-specific cloud smokes** — reminder preview is read-only client-side.

### Standalone reminder scripts

| Command | Phase |
|---------|-------|
| `npm run verify-reminder-template-preview` | 1 |
| `npm run verify-reminder-template-preview-ui` | 2 |
| `npm run verify-reminder-template-preview-actions` | 3 |
| `npm run verify-reminder-preview-dashboard` | 4 |

---

## Manual browser acceptance checklist

Use **local mode** for CSV and preview checks. Use **cloud + `?cloudWrites=1`** on staging for contact RPC saves.

Prerequisites:

```powershell
npm run build
npm run serve
```

Open `http://127.0.0.1:8877/` (or `index.html` via bundled `app.bundle.js`).

### Header and version

| Check | ☐ |
|-------|---|
| Header shows **v5.0.0-alpha.2** after load | |

### V5-1A — Contact (regression)

| Check | ☐ |
|-------|---|
| Add/edit forms show Email and Manager Email; invalid email blocked | |
| Register **Email** column and workspace Contact Information correct | |
| Contact Readiness insights and **Edit Contact** drilldown work | |
| Local CSV export/import includes contact columns | |

### V5-1B — Reminder preview modal

| Check | ☐ |
|-------|---|
| Action Required row shows **Preview Reminder Email** alongside Mark Sent | |
| Workspace shows preview when record is in 30/14/7-day or expired window | |
| Modal shows recipient, manager email (when set), subject, body, preview disclaimer | |
| Missing recipient warning when email absent; preview still opens | |
| **Copy subject**, **Copy body**, **Copy full email** work (or show clipboard fallback) | |
| **Export preview text file** downloads `.txt` with full email shape | |

### V5-1B — Reminder Preview Dashboard

| Check | ☐ |
|-------|---|
| Dashboard section shows 30/14/7-day, expired, and total previewable cards | |
| Counts exclude records without person email | |
| Clicking a card shows drilldown table (person, email, type, expiry, reminder type) | |
| **Preview Reminder** opens modal for that row | |
| **Open Workspace** and **Edit Contact** navigate correctly | |
| **Export Reminder Pack** downloads `.txt` with all previews in current drilldown | |

### Regression (no automation)

| Check | ☐ |
|-------|---|
| No send-email, digest, or queue UI added | |
| Mark Sent and reminder settings unchanged | |
| Insights calculations and existing CRUD unchanged aside from V5-1A contact fields | |

---

## Known limitations

| Limitation | Notes |
|------------|-------|
| **Preview only** | No SMTP, Resend, notification queue, or automated `mark_reminder_sent` |
| **Email required for dashboard counts** | Preview dashboard cards and drilldown include only qualifying reminders **with person email on file**; use Contact Readiness for missing-email gaps |
| **Manager email is reference only** | Shown in preview copy; not CC or send |
| **Local mode only for CSV contact import** | Cloud CSV import remains blocked |
| **No cloud reminder preview smokes** | V5-1B verification is static/DOM; cloud gate is V5-1A + existing RPC regression via `verify:phase2` |
| **Clipboard may be unavailable** | `file://` or restricted contexts show fallback message; export always available |
| **Automation platform not started** | V5-0 schema, cron, and feature flags are next; no Automation Settings UI yet |

---

## Next planned slice: V5-0 Automation Platform Foundation

**Goal:** Schema, RPC contracts, and daily scan skeleton without user-visible automation yet.

Planned deliverables (see [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md)):

- `automation_policies`, `automation_runs`, `notification_queue`, `delivery_log` tables
- Admin RPCs for policy and run listing
- Edge Function `daily_compliance_scan` (skeleton — logs run only)
- Feature flag `AUTOMATION_ENABLED` (off by default)
- `verify-automation-schema` smoke

**Exit criteria:** Staging cron fires daily scan; run logged; no notifications sent.

V5-1 (automated reminders & digests) follows once V5-0 and reminder preview foundation are in place.

---

## Phase 5 deliverables (V5-1B release gate)

- [x] `docs/v5-1b-reminder-template-preview.md` — Phase 5 section
- [x] `docs/v5-0-0-alpha-2-release-notes.md` (this file)
- [x] `ROADMAP.md` — v5.0.0-alpha.2 current release entry
- [x] `npm run verify-reminder-suite`
- [x] Version strings → **v5.0.0-alpha.2** (`js/data/config.js`, `index.html`, rebuilt `app.bundle.js`)
- [x] No git tag (unless explicitly requested)

**Behaviour:** No application logic changes in Phase 5 — documentation, verification orchestration, and version display only.

---

## Related docs

- [`docs/v5-1a-contact-management.md`](v5-1a-contact-management.md) — V5-1A alpha gate and browser checklist
- [`docs/v5-1b-reminder-template-preview.md`](v5-1b-reminder-template-preview.md) — V5-1B phases 1–5 detail
- [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md) — broader v5 automation roadmap
- [`ROADMAP.md`](../ROADMAP.md) — current release and slice tracker
