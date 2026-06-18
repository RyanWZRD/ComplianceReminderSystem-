# Compliance Reminder System Roadmap

A local-first safeguarding compliance tracker. Runs in the browser with localStorage by default, or against a shared Supabase cloud backend (v3.0.0+).

---

# Current Release

## v6.0.0-alpha.5 — V6 Resend Provider Release Readiness

**Date:** June 2026

### Summary

Fifth v6 alpha checkpoint: **V6** Resend provider release readiness on top of **v6.0.0-alpha.4** Resend plan foundation. Isolated Resend provider complete (`createResendEmailProvider` with injected `fetchImpl` only), Resend provider foundation verification orchestrator complete (`verify-resend-provider-foundation`), disabled-by-default provider mode — no `app.js` wiring, no UI send button, no automatic delivery execution, no mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — V6 phases 10–21 detail and release-readiness note
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — V6 phases 1–9 delivery foundation + phases 17–21 Resend provider track
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-21-complete) — V6 Resend provider release readiness summary

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — skeleton foundation + Resend plan + Resend provider orchestrator (no live execution)

Application version: **v6.0.0-alpha.5**

**Next slice:** V6 Phase 22 — Operations Log delivery UI + export — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md)

Status: Release candidate (V6 Phase 21)  
Tag: **v6.0.0-alpha.5** — not created unless explicitly requested

---

## V6 Phase 20 — Resend Provider Verification Orchestrator

**Date:** June 2026

### Summary

V6 Phase 20 adds `verify-resend-provider-foundation` — one verification command that runs provider skeleton foundation, Resend plan, and isolated Resend provider checks in order. Confirms the Resend implementation remains safe and not wired into app execution. Verification only — no app behaviour changes, UI send button, automatic delivery execution, or mark-as-sent automation.

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — Phase 20 orchestrator
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — Phase 20 architecture cross-reference
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-20-complete) — Phase 20 summary

**Verification (required):**

- `npm run verify-resend-provider-foundation` — master gate (skeleton foundation + Resend plan + Resend provider)

**Next slice:** V6 Phase 21 — Operations Log delivery UI + export

---

## V6 Phase 19 — Resend Provider Network Implementation

**Date:** June 2026

### Summary

V6 Phase 19 implements `createResendEmailProvider` with injected `fetchImpl` for Resend API calls. The provider module is isolated — no `app.js` wiring, no send button, no mark-as-sent automation, no compliance/action/history mutation, and no automatic delivery execution. Verified with mocked `fetchImpl` in CI (`verify-resend-provider`).

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — Phase 19 Resend network implementation
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — Phase 19 architecture cross-reference
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-19-complete) — Phase 19 summary

**Verification (required):**

- `npm run verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator (no live execution)
- `npm run verify-resend-provider` — Resend provider with mocked `fetchImpl`
- `npm run verify-resend-provider-plan` — Resend plan documentation + isolated module checks

**Next slice:** V6 Phase 20 — Operations Log delivery UI + export

---

## v6.0.0-alpha.4 — V6 Resend Plan Release Readiness

**Date:** June 2026

### Summary

Fourth v6 alpha checkpoint: **V6** Resend plan release readiness on top of **v6.0.0-alpha.3** provider skeleton foundation. Resend implementation plan complete (env vars, validation, test/production gates, failure mapping, rate limits, audit, rollback), Resend plan verification complete (`verify-resend-provider-plan`), provider skeleton modules unchanged (`resend-provider.js` still skeleton), disabled-by-default provider mode, mock provider only — no Resend network implementation, no API key usage, no network calls, no production sending, no mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — V6 phases 10–18 detail and release-readiness note
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — V6 phases 1–9 delivery foundation + phase 17–18 Resend plan
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-18-complete) — V6 Resend plan release readiness summary

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — V6 phases 12 + 14–15 orchestrator (no live execution)
- `npm run verify-resend-provider-plan` — Resend plan documentation; skeleton-only provider module

Application version: **v6.0.0-alpha.4** (superseded by v6.0.0-alpha.5)

**Next slice:** V6 Phase 19 — Resend network implementation — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md)

Status: Release candidate (V6 Phase 18)  
Tag: **v6.0.0-alpha.4** — not created unless explicitly requested

---

## v6.0.0-alpha.3 — V6 Provider Skeleton Foundation

**Date:** June 2026

### Summary

Third v6 alpha checkpoint: **V6** provider skeleton foundation (skeleton modules for Resend/SendGrid/SMTP, skeleton foundation verification orchestrator) on top of **v6.0.0-alpha.2** provider foundation and **v6.0.0-alpha.1** delivery foundation. Provider configuration complete (`getEmailProviderConfig`), provider adapter complete (`createEmailProviderAdapter`), provider skeleton modules complete, skeleton foundation verification orchestrator complete (`verify-email-provider-skeleton-foundation`), disabled-by-default provider mode, mock provider only — no real provider implementation, no network calls, no production sending, no mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — V6 phases 10–16 detail and release-readiness note
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — V6 phases 1–9 delivery foundation
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-16-complete) — V6 provider skeleton foundation summary

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — V6 phases 12 + 14–15 orchestrator (no live execution)

Application version: **v6.0.0-alpha.3** (superseded by v6.0.0-alpha.4)

**Next slice:** V6 Phase 19 — Resend network implementation — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md)

Status: Release candidate (V6 Phase 16)  
Tag: **v6.0.0-alpha.3** — not created unless explicitly requested

---

## v6.0.0-alpha.2 — V6 Provider Foundation

**Date:** June 2026

### Summary

Second v6 alpha checkpoint: **V6** provider foundation (configuration architecture, adapter interface, provider foundation verification orchestrator) on top of **v6.0.0-alpha.1** delivery foundation. Provider configuration complete (`getEmailProviderConfig`), provider adapter complete (`createEmailProviderAdapter`), disabled-by-default provider mode, mock provider only — no real provider implementation, no production sending, no mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) — V6 phases 10–13 detail and release-readiness note
- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — V6 phases 1–9 delivery foundation
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-13-complete) — V6 provider foundation summary

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-foundation` — V6 phases 10–12 orchestrator (no live execution)

Application version: **v6.0.0-alpha.2** (superseded by v6.0.0-alpha.3)

**Next slice:** V6 Phase 14 — real provider skeleton modules

Status: Release candidate (V6 Phase 13)  
Tag: **v6.0.0-alpha.2** — not created unless explicitly requested

---

## v6.0.0-alpha.1 — V6 Delivery Foundation

**Date:** June 2026

### Summary

First v6 alpha checkpoint: **V6** delivery foundation (domain model, in-memory delivery record builder, `reminder_delivery_logs` schema, delivery log RPC draft, state machine, mock email provider, mock delivery executor, foundation verification orchestrator). Builds on **v5.0.0-alpha.5** (V5-2 template & digest foundation). Mock provider only — no real email provider, no production sending, no mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) — V6 phases 1–9 detail and release-readiness note
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-9-complete) — V6 delivery foundation summary

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-delivery-foundation` — V6 phases 1–8 orchestrator (no live execution)

Application version: **v6.0.0-alpha.1** (superseded by v6.0.0-alpha.2)

**Next slice:** V6 Phase 10 — provider configuration architecture — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

Status: Release candidate (V6 Phase 9)  
Tag: **v6.0.0-alpha.1** — not created unless explicitly requested

---

## v5.0.0-alpha.5 — V5-2 Template & Digest Foundation

**Date:** June 2026

### Summary

Fifth v5 alpha checkpoint: **V5-2** template & digest foundation (queue-item email template builder, template preview UI, copy template, digest builder, digest preview UI, orchestrated verification). Builds on **v5.0.0-alpha.4** (V5-1 reminder queue foundation). No delivery provider, send button, mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) — V5-2 detail and release-readiness note
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-1--automated-reminders--digests) — prior V5-1 alpha.4 release gate

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-reminder-template-digest-foundation` — V5-1 queue foundation + V5-2 phases 1–6 orchestrator (no live execution)

Application version: **v5.0.0-alpha.5** (superseded by v6.0.0-alpha.1)

**Next slice:** V6 Phase 10 — real email provider integration — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

Status: Release candidate (V5-2 Phase 7)  
Tag: **v5.0.0-alpha.5** — not created unless explicitly requested

---

## v5.0.0-alpha.4 — V5-1 Reminder Queue Foundation

**Date:** June 2026

### Summary

Fourth v5 alpha checkpoint: **V5-1** reminder queue foundation (in-memory queue from dry-run, read-only preview UI, CSV export, orchestrated verification). Builds on **v5.0.0-alpha.3** (V5-0 automation platform). No live email sending, mark-as-sent automation, compliance/action/history mutation, or cloud mutation default changes.

**Documentation:**

- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) — V5-1 detail and release-readiness note
- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-0--automation-platform-foundation--complete-alpha) — prior V5-0 alpha.3 release gate

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-reminder-queue-foundation` — V5-0 foundation + V5-1 phases 1–4 orchestrator (no live execution)

Application version: **v5.0.0-alpha.4** (superseded by alpha.5)

**Next slice:** V6 Phase 6 — email provider integration — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

Status: Release candidate (V5-1 Phase 5)  
Tag: **v5.0.0-alpha.4** — not created unless explicitly requested

---

## v5.0.0-alpha.3 — V5-0 Automation Platform Foundation

**Date:** June 2026

### Summary

Third v5 alpha checkpoint: **V5-0** automation platform foundation (schema, policy/run RPCs, dry-run scan engine, dry-run audit logging, read-only automation audit UI, orchestrated verification). Builds on **v5.0.0-alpha.2** (V5-1A + V5-1B). No live automation execution, reminder delivery, action orchestration, or cloud mutation default changes.

**Documentation:**

- [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) — V5-0 detail and release-readiness note
- [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md) — prior alpha.2 release gate (V5-1A + V5-1B)

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-automation-v5-foundation` — V5-0 phases 1–8 orchestrator (no live execution)

Application version: **v5.0.0-alpha.3** (superseded by alpha.4)

---

## v5.0.0-alpha.2 — V5-1A Contact Management + V5-1B Reminder Template Preview

**Date:** June 2026

### Summary

Second v5 alpha checkpoint: **V5-1A** optional person email and manager email (register, CSV, Contact Readiness, drilldown-to-edit) plus **V5-1B** read-only reminder template preview (modal, copy/export, operational preview dashboard). No email delivery, automation, or permission changes.

**Documentation:**

- [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md) — alpha.2 release gate
- [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md) — V5-1A detail
- [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md) — V5-1B Phases 1–5

**Release verification (required before tag):**

- `npm run verify-reminder-suite` — V5-1B reminder preview chain (no Supabase)
- `npm run verify-contact-management` — V5-1A contact CSV/workspace + insights release chain (no Supabase)
- `npm run verify-insights-release` — insights regression subset
- `npm run verify:phase2` — requires `.env` + staging Supabase (includes cloud contact RPC smokes)

Application version: **v5.0.0-alpha.2** (superseded by alpha.3)

---

## v5.0.0-alpha.1 — V5-1A Contact Management

**Date:** June 2026

First v5 alpha checkpoint: optional person **email** and **manager email** across local/cloud data, add/edit forms, register and CSV, Compliance Insights **Contact Readiness**, and drilldown-to-edit workflow.

**Documentation:** [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md)

Application version: **v5.0.0-alpha.1** (superseded by alpha.2)

---

## V5-1B Phase 1 — Reminder Template Preview Foundation · Complete

**Date:** June 2026

Read-only reminder email template generation (`js/app/reminders/reminder-templates.js`) for 30/14/7-day and expired windows. Uses V5-1A contact emails when present. No sending, queue, or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview`

---

## V5-1B Phase 2 — Reminder Template Preview UI · Complete

**Date:** June 2026

On-screen **Preview Reminder Email** action in Action Required rows and record workspace (when in an active reminder window). Modal shows recipient/manager email, reminder type, subject, body, preview-only disclaimer, and missing-recipient warning. No email sending or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview-ui`

---

## V5-1B Phase 3 — Reminder Preview Copy and Export · Complete

**Date:** June 2026

Preview modal **Copy subject**, **Copy body**, **Copy full email**, and **Export preview text file** actions. Full email text includes To, manager email (when present), reminder type, subject, and body. Clipboard-unavailable fallback message; export always available. No email sending or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-template-preview-actions`

---

## V5-1B Phase 4 — Reminder Preview Dashboard · Complete

**Date:** June 2026

Operational **Reminder Preview Dashboard** with card counts (30/14/7-day, expired, total previewable), drilldown table (person, email, compliance type, expiry, reminder type), actions to preview/open workspace/edit contact, and **Export Reminder Pack** (`.txt` of all previews in drilldown). Counts include only qualifying reminders with email on file. No sending, queue, or automation.

**Documentation:** [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-preview-dashboard`

---

## V5-1B Phase 5 — Alpha Release Gate · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v5.0.0-alpha.2**. Combined release notes, `verify-reminder-suite`, version bump, browser acceptance checklist. No application logic changes.

**Documentation:** [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md) · [`docs/v5-1b-reminder-template-preview.md`](docs/v5-1b-reminder-template-preview.md)

**Verification:** `npm run verify-reminder-suite` · `npm run verify-contact-management` · `npm run verify-insights-release` · `npm run verify:phase2`

---

## V5-2 Phase 3 — Copy Reminder Template · Complete

**Date:** June 2026

Each expanded Reminder Queue Preview template includes a **Copy template** button. Copies `Subject: <subject>` plus body text to the clipboard for manual email use (`navigator.clipboard.writeText` when available). Shows *Template copied.* on success; friendly copy-unavailable message otherwise. No email sending, mark-as-sent, or history writes.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-2--reminder-email-template-builder--complete-alpha)

**Verification:** `npm run verify-reminder-template-copy`

---

## V5-2 Phase 4 — Reminder Digest Builder · Complete

**Date:** June 2026

Manager/admin digest generation from reminder queue items (`buildReminderDigest`). Summarises total queued, missing email, expired, and 30/14/7-day counts, plus a grouped follow-up list (person, compliance type, expiry, email or “Missing email”). Empty queues return a useful “no reminders due” digest. No email sending, mark-as-sent, or history writes.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-2--reminder-email-template-builder--complete-alpha)

**Verification:** `npm run verify-reminder-digest-builder`

---

## V5-2 Phase 5 — Reminder Digest Preview UI · Complete

**Date:** June 2026

The Reminder Queue Preview section includes a **Digest preview** area wired to `buildReminderDigest` from current queue items. Shows subject, body (`textContent`), summary metadata counts (total queued, missing email, expired, 30/14/7-day), safety note (*Digest preview only — no email is sent.*), and **Copy digest** button (`Subject:` + bodyText via clipboard). No email sending, mark-as-sent, or history writes.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-2--reminder-email-template-builder--complete-alpha)

**Verification:** `npm run verify-reminder-digest-preview-ui`

---

## V5-2 Phase 6 — Template & Digest Foundation Verification · Complete

**Date:** June 2026

Single orchestrated verification command that runs V5-1 queue foundation plus V5-2 template and digest phase scripts in order (queue foundation, template builder, template preview UI, copy template, digest builder, digest preview UI). Stops on first failure. Verification-only — no delivery provider integration, send functionality, mark-as-sent, or compliance/action/history mutation.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-2--reminder-email-template-builder--complete-alpha)

**Verification:** `npm run verify-reminder-template-digest-foundation`

---

## V5-2 Phase 7 — Template & Digest Foundation Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v5.0.0-alpha.5**. Version bump, release-readiness docs, `verify-reminder-template-digest-foundation` gate. No application logic changes. No delivery provider, send button, mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-2--reminder-email-template-builder--complete-alpha)

**Verification:** `npm run build` · `npm run verify-reminder-template-digest-foundation`

---

## v3.0.0 Released

**Date:** June 2026

### Major achievements

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions
- Compliance CRUD parity
- Verification framework
- First production release

Status: Released  
Tag: v3.0.0

---

# Next Planned Release

## V6.0.0 Phase 21 — Resend Provider Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v6.0.0-alpha.5**. Version bump, release-readiness docs, `verify-resend-provider-foundation` gate. No application logic changes. Isolated Resend provider complete (`createResendEmailProvider` with injected `fetchImpl` only), Resend provider foundation verification orchestrator complete, disabled-by-default provider mode — no `app.js` wiring, no UI send button, no automatic delivery execution, no mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-21-complete)

**Verification:** `npm run build` · `npm run verify-resend-provider-foundation`

**Release candidate:** **v6.0.0-alpha.5**

**Next slice:** V6 Phase 22 — Operations Log delivery UI + export

---

## V6.0.0 Phase 18 — Resend Plan Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v6.0.0-alpha.4**. Version bump, release-readiness docs, `verify-email-provider-skeleton-foundation` and `verify-resend-provider-plan` gates. No application logic changes. Resend implementation plan complete, `resend-provider.js` remains skeleton, disabled-by-default provider mode, mock provider only — no Resend network implementation, no API key usage, no network calls, no production sending, no mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-18-complete)

**Verification:** `npm run build` · `npm run verify-email-provider-skeleton-foundation` · `npm run verify-resend-provider-plan`

**Release candidate:** **v6.0.0-alpha.4**

**Next slice:** V6 Phase 19 — Resend network implementation (`createResendEmailProvider`)

---

## V6.0.0 Phase 17 — Resend Implementation Plan · Complete

**Date:** June 2026

Documentation checkpoint for the first real email provider: exact Resend implementation plan (env vars, from/reply-to validation, test/production gates, failure mapping, rate limits, audit logging, rollback) before network code. Adds `npm run verify-resend-provider-plan`. Planning only — `resend-provider.js` remains skeleton; no `fetch`, SDK, SMTP, production sending, mark-as-sent automation, or `app.js` wiring.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md#phase-17--resend-implementation-plan) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md)

**Verification:** `npm run verify-resend-provider-plan` · `npm run verify-email-provider-skeleton-foundation`

**Next slice:** V6 Phase 19 — Resend network implementation (`createResendEmailProvider`)

---

## V6.0.0 Phase 16 — Provider Skeleton Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v6.0.0-alpha.3**. Version bump, release-readiness docs, `verify-email-provider-skeleton-foundation` gate. No application logic changes. Provider skeleton modules complete, skeleton foundation verification orchestrator complete, disabled-by-default provider mode, mock provider only — no real provider implementation, no network calls, no production sending, no mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-16-complete)

**Verification:** `npm run build` · `npm run verify-email-provider-skeleton-foundation`

**Release candidate:** **v6.0.0-alpha.3**

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 15 — Provider Skeleton Foundation Verification · Complete

**Date:** June 2026

One verification command proving provider config, adapter, skeleton modules, and delivery foundation all remain safe before real provider implementation. Adds `npm run verify-email-provider-skeleton-foundation` to run `verify-email-provider-foundation` and `verify-email-provider-skeletons` in order, stop on first failure, and print a single success gate.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-15-complete)

**Verification:** `npm run verify-email-provider-skeleton-foundation`

**Constraints:** Verification orchestration only. No app behaviour changes. No real email provider, network calls, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 14 — Real Provider Skeletons · Complete

**Date:** June 2026

Placeholder provider modules for future Resend, SendGrid, and SMTP integration. Each skeleton exports `create<Provider>EmailProvider({ config })` with `healthCheck()` returning `{ status: "not_implemented", provider: "<name>" }` and `sendReminder()` throwing `Provider <name> is not implemented yet`. Adapter routes enabled real providers to skeleton modules. Mock provider unchanged. No fetch, API keys, SDKs, SMTP transport, real sending, mark-as-sent automation, or `app.js` wiring.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-14-complete)

**Verification:** `npm run verify-email-provider-skeletons` · `npm run verify-email-provider-foundation`

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 13 — Provider Foundation Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v6.0.0-alpha.2**. Version bump, release-readiness docs, `verify-email-provider-foundation` gate. No application logic changes. Provider configuration complete, provider adapter complete, disabled-by-default provider mode, mock provider only — no real provider implementation, no production sending, no mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-13-complete)

**Verification:** `npm run build` · `npm run verify-email-provider-foundation`

**Release candidate:** **v6.0.0-alpha.2**

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 12 — Provider Foundation Verification Orchestrator · Complete

**Date:** June 2026

One verification command for the provider configuration and adapter foundation before any real provider is implemented. Adds `npm run verify-email-provider-foundation` to run `verify-email-provider-config`, `verify-email-provider-adapter`, and `verify-delivery-foundation` in order, stop on first failure, and print a single success gate.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

**Verification:** `npm run verify-email-provider-foundation`

**Constraints:** Verification orchestration only. No app behaviour changes. No real email provider, network calls, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 11 — Provider Adapter Interface · Complete

**Date:** June 2026

Interface/factory checkpoint for email provider resolution. Adds `createEmailProviderAdapter({ config, mockProvider })` — disabled provider when `config.enabled` is false, mock delegation when `provider === "mock"`, and not-implemented placeholders for Resend/SendGrid/SMTP. No real provider SDKs, network calls, sending, or app wiring.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

**Verification:** `npm run verify-email-provider-adapter` · `npm run verify-email-provider-config` · `npm run verify-delivery-foundation`

**Constraints:** Interface/factory only. Not imported in `app.js`. No real provider implementation, no mark-as-sent automation or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 10 — Provider Configuration Architecture · Complete

**Date:** June 2026

Documentation and config-shape checkpoint for safe future email provider integration. Defines Resend/SendGrid/SMTP options, environment variables, sender/reply-to rules, test vs production mode, rate limits, health checks, secret handling, audit, and GDPR notes. Adds `getEmailProviderConfig(env)` with safe disabled defaults. No real provider, no sending, no app wiring.

**Documentation:** [`docs/v6-email-provider-configuration.md`](docs/v6-email-provider-configuration.md) · [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

**Verification:** `npm run verify-email-provider-config` · `npm run verify-delivery-foundation`

**Constraints:** Configuration/design only. `enabled: false`, `mode: disabled`, `provider: none` by default. Not imported in `app.js`. No mark-as-sent automation or compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 9 — Delivery Foundation Release Readiness · Complete

**Date:** June 2026

Documentation and verification checkpoint for **v6.0.0-alpha.1**. Version bump, release-readiness docs, `verify-delivery-foundation` gate. No application logic changes. Mock provider only — no real email provider, no production sending, no mark-as-sent automation, or compliance/action/history mutation.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md) · [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v6--reminder-delivery--phase-9-complete)

**Verification:** `npm run build` · `npm run verify-delivery-foundation`

**Release candidate:** **v6.0.0-alpha.1**

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 8 — Delivery Foundation Verification Orchestrator · Complete

**Theme:** One verification command that proves the delivery architecture, delivery records, schema, RPCs, state machine, mock provider, and mock executor all work together — without real sending.

Builds on **v6.0.0 Phase 7** (mock delivery executor). Adds `npm run verify-delivery-foundation` to run phases 1–7 verification scripts in order, stop on first failure, and print a single success gate.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Mock delivery executor (`executeMockReminderDelivery`) | **Complete** |
| 8 | Delivery foundation verification orchestrator (`verify-delivery-foundation`) | **Complete** |
| 9 | Release readiness / alpha tag prep (`v6.0.0-alpha.1`) | **Complete** |
| 10 | Provider configuration architecture (`getEmailProviderConfig`) | **Complete** |
| 11 | Provider adapter interface (`createEmailProviderAdapter`) | **Complete** |
| 12 | Provider foundation verification orchestrator (`verify-email-provider-foundation`) | **Complete** |
| 13 | Provider foundation release readiness (`v6.0.0-alpha.2`) | **Complete** |
| 14 | Real provider implementation | Planned |

**Verification:** `npm run verify-delivery-foundation` (master gate); individual phase scripts remain available for targeted checks

**Constraints:** Verification orchestration only. No real email provider, no production delivery, no mark-as-sent automation, no app wiring, no compliance/action/history mutation.

**Next slice:** V6 Phase 17 — real provider network implementation

---

## V6.0.0 Phase 7 — Mock Delivery Executor · Complete

**Theme:** In-memory mock delivery execution — orchestrates state machine transitions and mock provider calls without real sends or app wiring.

Builds on **v6.0.0 Phase 6** (mock email provider). Adds `executeMockReminderDelivery({ records, provider, at })` to process `prepared` records through `sending` to `delivered` or `failed`, skip terminal and missing-email records, and return execution summary counts.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Mock delivery executor (`executeMockReminderDelivery`) | **Complete** |
| 8 | Real email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` · `npm run verify-reminder-delivery-state-machine` · `npm run verify-mock-email-provider` · `npm run verify-mock-delivery-executor` (in-memory checks only)

**Constraints:** Mock execution only. No real email provider, no production delivery, no mark-as-sent automation, no app wiring.

**Next slice:** V6 Phase 9 — real email provider integration

---

## V6.0.0 Phase 6 — Mock Email Provider · Complete

**Theme:** Simulated email provider adapter for testing delivery flow — without real sends or app wiring.

Builds on **v6.0.0 Phase 5** (delivery state machine). Adds `createMockEmailProvider({ mode })` with `sendReminder` and `healthCheck`, supporting `success`, `transient_failure`, and `permanent_failure` modes.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Mock delivery executor (`executeMockReminderDelivery`) | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` · `npm run verify-reminder-delivery-state-machine` · `npm run verify-mock-email-provider` (in-memory checks only)

**Constraints:** Mock provider only. No real email provider, no delivery execution, no mark-as-sent automation, no app wiring.

**Next slice:** V6 Phase 7 — mock delivery executor

---

## V6.0.0 Phase 5 — Delivery State Machine · Complete

**Theme:** Pure in-memory state transitions for reminder delivery records — without provider integration or app wiring.

Builds on **v6.0.0 Phase 4** (delivery log RPC draft). Adds `transitionReminderDeliveryRecord` with validated lifecycle transitions, timestamp fields, failure/cancellation reasons, and `statusHistory` audit entries.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Real email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` · `npm run verify-reminder-delivery-state-machine` · `npm run verify-mock-email-provider` (in-memory checks only)

**Constraints:** State logic only. No email provider, no delivery execution, no mark-as-sent automation, no app wiring.

**Next slice:** V6 Phase 7 — real email provider integration

---

## V6.0.0 Phase 4 — Delivery Log RPC Draft · Complete

**Theme:** Controlled Postgres RPCs for creating and reading reminder delivery logs — without wiring into app behaviour.

Builds on **v6.0.0 Phase 3** (delivery log schema). Adds `public.create_reminder_delivery_log(...)` (admin-only insert) and `public.get_reminder_delivery_logs(p_organisation_id uuid)` (admin/editor read).

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` · `npm run verify-reminder-delivery-log-schema` · `npm run verify-reminder-delivery-log-rpcs` · `npm run verify-reminder-delivery-state-machine` (static / in-memory checks only)

**Constraints:** Database RPC only. No email provider, no delivery execution, no mark-as-sent automation, no app wiring.

**Next slice:** V6 Phase 6 — email provider integration

---

## V6.0.0 Phase 3 — Delivery Log Schema · Complete

**Theme:** Postgres schema for per-recipient reminder delivery audit records — without wiring into app behaviour.

Builds on **v6.0.0 Phase 2** (in-memory delivery record builder) and **v5.0.0-alpha.5** (V5-2 template & digest foundation). Adds `public.reminder_delivery_logs` with lifecycle status constraint, dedup unique index, RLS policies, and `updated_at` trigger.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` · `npm run verify-reminder-delivery-log-schema` (static checks only)

**Constraints:** Schema only. No email provider, no delivery execution, no mark-as-sent automation, no app wiring.

**Next slice:** V6 Phase 6 — email provider integration

---

## V6.0.0 Phase 2 — Delivery Record Builder · Complete

**Theme:** Create in-memory delivery records from reminder queue items and templates — without sending.

Builds on **v6.0.0 Phase 1** (delivery domain model) and **v5.0.0-alpha.5** (V5-2 template & digest foundation). Produces per-recipient delivery records with `prepared` or `failed` (missing email) status from queue items via `buildReminderEmailTemplate`.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` · `npm run verify-reminder-delivery-record-builder` (no Supabase)

**Constraints:** Record preparation only. No email provider, no delivery execution, no mark-as-sent automation, no database writes.

**Next slice:** V6 Phase 6 — email provider integration

---

## V6.0.0 Phase 1 — Delivery Domain Model · Complete

**Theme:** Architecture for how reminder emails would be sent and audited — without implementing delivery.

Builds on **v5.0.0-alpha.5** (V5-2 template & digest foundation). Defines delivery lifecycle, reminder delivery record shape, audit requirements, duplicate-prevention rules, retry strategy, and future `EmailProvider` abstraction.

**Documentation:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model architecture doc + verification | **Complete** |
| 2 | In-memory delivery record builder | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Email provider integration | Planned |

**Verification:** `npm run verify-delivery-architecture` (no Supabase)

**Constraints:** No email provider, no delivery execution, no mark-as-sent automation, no compliance/action/history mutation.

**Next slice:** V6 Phase 6 — email provider integration

---

## V5-2 — Reminder email template builder · Foundation complete

Template & digest foundation shipped as **v5.0.0-alpha.5**. Next work: **V6 Phase 1** delivery domain model. Prerequisite **V5-1** reminder queue foundation (**v5.0.0-alpha.4**) satisfied.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) (V5-2 section)

**Prior alpha:** v5.0.0-alpha.4 — V5-1 Phases 1–5 complete; see [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-1--automated-reminders--digests)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Reminder email template builder (`buildReminderEmailTemplate`) | **Complete** |
| 2 | Queue template preview UI (per-row expandable preview) | **Complete** |
| 3 | Copy template action (clipboard copy for manual use) | **Complete** |
| 4 | Reminder digest builder (`buildReminderDigest`) | **Complete** |
| 5 | Digest preview UI (subject, body, metadata, Copy digest) | **Complete** |
| 6 | Foundation verification orchestrator (`verify-reminder-template-digest-foundation`) | **Complete** |
| 7 | Release readiness / alpha tag prep (`v5.0.0-alpha.5`) | **Complete** |

**Release candidate:** **v5.0.0-alpha.5**

**Verification:** `npm run build` · `npm run verify-reminder-template-digest-foundation` (runs V5-1 queue foundation + V5-2 phases 1–6 in order; stop on first failure) · individual phase scripts remain available (no Supabase)

**Constraints:** No delivery provider, send button, mark-as-sent automation, or compliance/action/history mutation.

**Next slice:** V6 Phase 6 — email provider integration — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

---

## V5-1 — Automated reminders & digests · Foundation complete

Reminder queue foundation shipped as **v5.0.0-alpha.4**. Template & digest foundation shipped as **v5.0.0-alpha.5**. Prerequisite **V5-0** automation platform foundation (**v5.0.0-alpha.3**) satisfied.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) (V5-1 section)

**Prior alpha:** v5.0.0-alpha.4 — V5-1 Phases 1–5 complete; see [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md#v5-1--automated-reminders--digests)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Reminder queue foundation (`buildReminderQueueFromDryRun`) | **Complete** |
| 2 | Reminder queue preview UI (read-only dashboard section) | **Complete** |
| 3 | Reminder queue preview CSV export (`buildReminderQueueExportCsv`) | **Complete** |
| 4 | Foundation verification orchestrator (`verify-reminder-queue-foundation`) | **Complete** |
| 5 | Release readiness / alpha tag prep (`v5.0.0-alpha.4`) | **Complete** |

**Release candidate:** **v5.0.0-alpha.4**

**Verification:** `npm run build` · `npm run verify-reminder-queue-foundation` (runs V5-0 foundation + phases 1–3 in order; stop on first failure) · individual phase scripts remain available (no Supabase)

**Next slice:** V6 Phase 6 — email provider integration — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

---

## V5-0 — Automation Platform Foundation · Complete

Schema, RPC contracts, dry-run scan engine, audit logging, read-only audit UI, and orchestrated verification — without live automation execution. Shipped as **v5.0.0-alpha.3**.

**Documentation:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) (V5-0 section)

**Prior alpha:** v5.0.0-alpha.2 — V5-1A + V5-1B complete; see [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | `automation_policies` + `automation_runs` tables, `AUTOMATION_ENABLED` | **Complete** |
| 2 | Policy admin RPCs (`get_automation_policies`, `upsert_automation_policy`) | **Complete** |
| 3 | Run read RPCs (`get_automation_runs`, `get_automation_run`) | **Complete** |
| 4 | Run creation RPC (`create_automation_run`) | **Complete** |
| 5 | Dry-run scan engine (`computeAutomationDryRun`) | **Complete** |
| 6 | Dry-run run logging (`logAutomationDryRunRun`) | **Complete** |
| 7 | Automation run audit UI (read-only runs table + summary) | **Complete** |
| 8 | Foundation verification orchestrator (`verify-automation-v5-foundation`) | **Complete** |
| 9 | Release readiness / alpha tag prep | **Complete** |

**Release candidate:** **v5.0.0-alpha.3**

**Verification:** `npm run build` · `npm run verify-automation-v5-foundation` (runs phases 1–7 in order; stop on first failure)

---

# Future Releases

## v5.0.0 — Automated Compliance Operations · In progress (alpha)

Scheduled compliance operations: reminder delivery, action orchestration, escalations, and operations audit. **V5-1A** shipped as **v5.0.0-alpha.1**; **V5-1B Reminder Template Preview** shipped as **v5.0.0-alpha.2**. See [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md), [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md), and [`docs/v5-0-0-alpha-2-release-notes.md`](docs/v5-0-0-alpha-2-release-notes.md).

**Prerequisites:** v4.0.1 GA + v3.1.0 cloud follow-on.

**Alpha verification:**

- `npm run verify-reminder-suite` — V5-1B release gate (no Supabase)
- `npm run verify-contact-management` — V5-1A release gate (no Supabase)
- `npm run verify:phase2` — cloud regression including contact RPC smokes

**Next slice:** V6 Phase 6 — email provider integration — see [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

## v4.0.1 — Compliance Insights GA · RC hardening complete

Read-only compliance insights on the dashboard: health score, risk summary, renewal forecast, and rule-based recommendations. See [`docs/compliance-insights.md`](docs/compliance-insights.md) and [Version Roadmap — v4](#v4--compliance-insights-release-candidate).

Application version: **v6.0.0-alpha.5** in source (V6 Resend provider release readiness alpha); v4 GA target **v4.0.1**.

**RC hardening summary (June 2026):**

| ID | Fix |
|----|-----|
| RC-001 | Cloud in-progress action completion (`set_action_status` migration `20260203000017`) |
| RC-002 | Cloud bulk mark reminders |
| RC-003 | Filtered register CSV export |
| RC-004 | Terminology consistency (register, status, archive) |
| RC-005 | Stale evidence insight label clarity |
| RC-006 | Error and warning message styling |
| RC-007 | Register count scope clarity (all-records vs filtered view) |
| RC-008 | Renew workflow wording |
| RC-009 | Cloud evidence metadata-only clarity |
| RC-010 | Final hardening summary and release checklist |

**Release docs:** [`docs/v4-0-1-release-notes.md`](docs/v4-0-1-release-notes.md)  
**Manual browser acceptance:** [`docs/v4-rc-browser-acceptance.md`](docs/v4-rc-browser-acceptance.md) (V4-RC1A)

**Release verification (required before tag):**

- `npm run verify-insights-release` — engine, browser smoke, build, RC-004–RC-009 terminology
- `npm run verify:phase2` — requires `.env` + staging Supabase (includes RC-001–RC-003 cloud smokes)

Recommended tag: **v4.0.1** (GA pending sign-off and version string bump)

## v5.0.0 — Automated Compliance Operations · Planned

Scheduled compliance operations: reminder delivery, action orchestration, escalations, and operations audit. See [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md) and [Version Roadmap — v5](#v500--automated-compliance-operations--planned).

**Prerequisites:** v4.0.1 GA + v3.1.0 cloud follow-on.

## v3.1.0 — Cloud platform follow-on · Planned

- Evidence storage buckets and uploads
- CSV/backup import migration path
- Restore/unarchive and bulk archive/delete
- Production cloud-writes policy and GDPR checklist

---

# Recent Releases

## v3.0.0 Released

**Date:** June 2026

### Major achievements

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions
- Compliance CRUD parity
- Verification framework
- First production release

Status: Released  
Tag: v3.0.0

---

## v2.9.0 Released

### Visual Insights & Compliance Charts

- Expiry by Month chart
- Compliance Status Breakdown
- Evidence Coverage chart
- Action Workload chart
- Management Snapshot
- Snapshot CSV export
- Snapshot print support

QA Status: PASS with warnings

Status: Released  
Tag: v2.9.0

---

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

Versions are listed **oldest to newest**. Everything through **v3.0.0** is shipped. **v3.1.0** is next.

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
* Total Records, Valid, Expiring 30/60/90, Expired metrics

### v1.5.0 — Advanced filtering · Shipped

* Extended search (name, role, type, notes, dates)
* Expiry window filter dropdown
* Active filter chips and clear-all
* Clickable analytics cards (filter the table from analytics)
* Compatible status/expiry filter handling

### v1.6.0 — Record management and UX · Shipped

* Edit compliance record (name, role, type, expiry, notes)
* Archive confirmation
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

### v2.9.0 — Visual Insights & Compliance Charts · Shipped

- Expiry by Month chart
- Compliance Status Breakdown
- Evidence Coverage chart
- Action Workload chart
- Management Snapshot
- Snapshot CSV export
- Snapshot print support

QA Status: PASS with warnings

### v2.8 — Supabase Auth · Shipped (included in v3.0.0)

- Supabase Auth login/logout
- Real user sessions replacing mock preview user
- Read-only cloud sync (initial)

### v3.0.0 — Cloud Platform Foundation · Shipped

**Date:** June 2026

- Cloud platform complete
- RPC-only write architecture
- Role-based permissions (Admin, Editor, Viewer)
- Compliance CRUD parity (records, actions, evidence metadata, history, archive)
- Verification framework (`npm run verify:phase2`)
- First production release

Status: Released  
Tag: v3.0.0

### v3.0.0 Alpha — Phase 2 (operational cloud) · Shipped (Step 12 hardening)

- Supabase login, org-scoped load, admin/editor/viewer read parity
- Limited RPC writes when explicitly enabled (not default): mark sent, action complete/reopen, action create/delete, renew, add record, edit record (no notes column write); workspace notes via P3-4 RPC
- `canMutateData()` false in cloud; no `CloudComplianceStore.save()`
- Verify: `npm run verify:phase2` — see `docs/cloud-phase2-completion.md`

### Phase 3 — Cloud writes & verification

| Item | Status |
|------|--------|
| P3-1 Verification hardening | **COMPLETE** |
| P3-2 Reminder settings | **COMPLETE** |
| P3-4 Compliance notes | **COMPLETE** |
| P3-5A Action create/delete | **COMPLETE** ✅ |
| P3-5B Action update & in-progress | **COMPLETE** ✅ |
| P3-5C Default & bulk actions | **COMPLETE** ✅ |
| P3-6A Evidence create | **COMPLETE** ✅ |
| P3-6B Evidence delete | **COMPLETE** ✅ |
| P3-6C Evidence update | **COMPLETE** ✅ |
| P3-7A Record archive/delete | **COMPLETE** ✅ |
| P3-8 Final hardening / RC | **COMPLETE** ✅ |

#### P3-8 Final hardening / release candidate · Complete

**Status:** COMPLETE ✅

- Phase 3 cloud-write audit (RPC-only browser writes; permission gating documented)
- `npm run verify:phase2` — v3.0.0 release gate (migrations through `20260203000016`, pre/post reset)
- `reset-alpha-staging-data.mjs` — canonical counts (5/6/2/2/3/1); Step10 + P37A cleanup
- Docs: `docs/v3-release-checklist.md`, `docs/cloud-phase3-completion.md`, README/data-layer/cloud-setup
- Application version: `v3.0.0-rc1` (RC); GA **`v3.0.0`** released June 2026
- Recommended tag: `v3.0.0`

#### P3-1 Verification hardening · Complete

**Status:** COMPLETE

- `npm run verify:phase2` — single entry point for automated cloud verification + build
- Pre/post staging reset via `reset-alpha-staging-data.mjs` (idempotent; canonical seed counts)
- Step10 Verify person cleanup and Alex Volunteer two-record invariant in reset
- Per-feature cloud write smoke scripts wired into the phase2 suite

#### P3-2 Reminder settings · Complete

**Status:** COMPLETE

- RPC `update_reminder_settings` (migration `20260203000006`) — org-level `days_30`, `days_14`, `days_7`, `hide_sent_reminders`
- Admin only (`canMutateReminderSettings()` when `CLOUD_WRITES_ENABLED`; editors/viewers denied)
- `canMutateData()` stays false in cloud; RPC-first via `CloudSettingsStore.updateReminderSettings()`
- Existing reminder settings UI works when cloud writes enabled (`?cloudWrites=1` on allowed hosts)
- Verify: `npm run verify-cloud-update-reminder-settings` (included in `verify:phase2`)
- Staging reset restores seed reminder settings (`reset-alpha-staging-data.mjs`)

#### P3-4 Compliance notes · Complete

**Status:** COMPLETE (minimal v1)

- RPC `update_compliance_record_notes` (migration `20260203000007`) — server-side protected-line enforcement
- Editor/admin (`canUpdateComplianceRecordNotes()` when `CLOUD_WRITES_ENABLED`)
- Workspace Save Notes only; edit-form notes disabled in cloud
- Verify: `npm run verify-cloud-update-compliance-record-notes` (in `verify:phase2`)

#### P3-5A Action create/delete · Complete

**Status:** COMPLETE ✅

- RPC `create_action` (migration `20260203000008`) — open action + `action_added` history
- RPC `delete_action` (migration `20260203000009`) — `action_deleted` history before removal
- Editor/admin (`canMutateActions()` when `CLOUD_WRITES_ENABLED`; separate from `canSetActionStatus()`)
- Add Action modal + workspace Add Action + delete button wired
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.createAction()` / `deleteAction()`
- Reset: `pruneNonSeedActions()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-create-delete-action` (in `verify:phase2`)

#### P3-5B Action update & in-progress · Complete

**Status:** COMPLETE ✅

- RPC `set_action_in_progress` (migration `20260203000010`) — open → in_progress + `action_updated` history
- RPC `update_action` (migration `20260203000011`) — metadata only (title, notes, due date, owner); no status/completed fields
- Editor/admin (`canMutateActions()`); Mark in progress + Edit Action modal wired in cloud
- Complete/reopen unchanged (`set_action_status` via `canSetActionStatus()`)
- Edit modal status field hidden in cloud (dedicated RPCs for status transitions)
- Verify: `npm run verify-cloud-action-update-progress` (in `verify:phase2`)

#### P3-5C Default & bulk actions · Complete

**Status:** COMPLETE ✅

- RPC `add_default_actions` (migration `20260203000012`) — five templates; skip duplicate titles per record; one `action_added` history per new action
- Bulk add uses client loop of `create_action` (no bulk SQL RPC); single reload after operation
- Editor/admin (`canMutateActions()`); workspace Add default actions + bulk toolbar wired
- `persistAddDefaultActions()` / `persistBulkCreateAction()` — no `savePeople()` in cloud
- Verify: `npm run verify-cloud-default-bulk-actions` (in `verify:phase2`)

#### P3-5 Action writes · Complete

**Status:** COMPLETE ✅ (P3-5A + P3-5B + P3-5C)

#### P3-6A Evidence create · Complete

**Status:** COMPLETE ✅

- RPC `create_evidence` (migration `20260203000013`) — metadata-only insert into `evidence_items` + `evidence_added` history
- Editor/admin (`canMutateEvidence()` when `CLOUD_WRITES_ENABLED`; separate from `canMutateActions()`)
- Add Evidence modal + workspace Add Evidence wired; file attachments blocked in cloud (metadata only)
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.createEvidence()`
- Reset: `pruneNonSeedEvidence()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-create-evidence` (in `verify:phase2`)
- Not in scope: evidence edit, Storage uploads

#### P3-6B Evidence delete · Complete

**Status:** COMPLETE ✅

- RPC `delete_evidence` (migration `20260203000014`) — `evidence_deleted` history before row removal
- Delete button on evidence items when `canMutateEvidence()` (editor/admin); `persistDeleteEvidence()` + reload
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.deleteEvidence()`
- Verify: `npm run verify-cloud-delete-evidence` (in `verify:phase2`)
- Not in scope: evidence edit, Storage uploads, record archive/delete

#### P3-6C Evidence update · Complete

**Status:** COMPLETE ✅

- RPC `update_evidence` (migration `20260203000015`) — metadata-only update + `evidence_updated` history
- Edit button on evidence items when `canMutateEvidence()`; reuses evidence modal (file input hidden in cloud)
- `persistUpdateEvidence()` + `reloadCloudDataAfterWrite()`; local edit unchanged pattern (in-memory + history)
- `canMutateData()` stays false in cloud; RPC-first via `CloudComplianceStore.updateEvidence()`
- Verify: `npm run verify-cloud-update-evidence` (in `verify:phase2`)
- **P3-6 evidence metadata CRUD complete** (create / update / delete)
- Not in scope: Storage uploads, file replacement in cloud, record archive/delete

#### P3-7A Record archive/delete · Complete

**Status:** COMPLETE ✅

- RPC `archive_compliance_record` (migration `20260203000016`) — deleted snapshot with record/history/evidence/actions JSON, then remove active row (and person when last record)
- Workspace **Archive Record** when `canArchiveComplianceRecord()`; `persistArchiveComplianceRecord()` + `reloadCloudDataAfterWrite()`
- Local delete unchanged (in-memory snapshot + remove active record); cloud RPC-first (no browser table writes)
- `canMutateData()` stays false in cloud
- Reset: `pruneNonSeedDeletedSnapshots()` in `reset-alpha-staging-data.mjs`
- Verify: `npm run verify-cloud-archive-compliance-record` (in `verify:phase2`)
- Not in scope: restore/unarchive, bulk archive/delete

#### Evidence metadata (CRUD) · Complete

**Status:** COMPLETE ✅ (P3-6A / P3-6B / P3-6C)

- Metadata create, update, delete via RPC; Storage buckets / uploads follow-on

**Phase 3 (remaining for GA):** Shipped in v3.0.0 GA (June 2026). Follow-on items moved to [v3.1.0](#v310--cloud-platform-follow-on--planned).

### v3.1.0 — Cloud platform follow-on · Planned

- Production cloud writes policy and GDPR checklist
- Evidence storage buckets and uploads
- CSV/backup import migration path
- Restore/unarchive and bulk archive/delete

---

## v4 — Compliance Insights (release candidate)

V4 adds a read-only **Compliance Insights** layer on the existing dashboard. Application version is **v4.0.0-rc1**.

Documentation: [`docs/compliance-insights.md`](docs/compliance-insights.md)

Verification:

- `npm run verify-insights-release` — full V4 release chain (engine → browser smoke → build)
- `npm run verify:phase2` — v3.0.0 cloud release gate (requires `.env` + staging Supabase)

| Slice | Status | Summary |
|-------|--------|---------|
| V4-0A | **COMPLETE** | Insights engine — normalize rows, health/risk/forecast metrics |
| V4-0B | **COMPLETE** | Dashboard metric mappings to legacy register cards |
| V4-0C | **COMPLETE** | Compliance Insights UI — health score, risk, forecast sections |
| V4-0D | **COMPLETE** | Drilldown filters, preview table, CSV export |
| V4-1A | **COMPLETE** | Recommendations engine and Recommended Actions UI |
| V4-1B | **COMPLETE** | Recommendation polish, threshold constants, documentation |
| V4-1C | **COMPLETE** | Alpha hardening, version bump to v4.0.0-alpha |
| V4-2A | **COMPLETE** | Operational health — reminder follow-up score and recommendation |
| V4-2B | **COMPLETE** | Composite health score includes operational health (4-way average) |
| V4-2C | **COMPLETE** | Operational health drilldown columns, preview explanation, sub-score summary |
| V4-3A | **COMPLETE** | Evidence gap tiers — critical/high/stale classification, cards, drilldowns, tier-based recommendations |
| V4-3B | **COMPLETE** | Compliance Insights UX polish — section hierarchy, helper text, empty states, drilldown preview clarity, recommendation priority badges |
| V4-3C | **COMPLETE** | Compliance Insights export pack — summary CSV, drilldown preview export, dated filenames, read-only export helpers |
| V4-3D | **COMPLETE** | Compliance Insights browser smoke test pack — static DOM/wiring checks for section UI, exports, drilldown preview, and empty states |
| V4-3E | **COMPLETE** | Compliance Insights release verification — single command runs engine, browser smoke, and build checks in order |
| V4-RC | **COMPLETE** | v4.0.0-rc1 prepared — version strings updated; `verify-insights-release` passed |
| V4-RC1A | **COMPLETE** | Browser acceptance checklist and bug capture format — `docs/v4-rc-browser-acceptance.md` |
| V4-RC-HARDENING | **COMPLETE** | RC-001–RC-010 hardening — cloud fixes, terminology, UX clarity; `docs/v4-0-1-release-notes.md` |

**RC hardening (June 2026):** Complete. See [`docs/v4-0-1-release-notes.md`](docs/v4-0-1-release-notes.md) for fixes, verification gates, browser checklist, and tagging steps.

| ID | Summary |
|----|---------|
| RC-001 | Cloud in-progress → completed action transition |
| RC-002 | Cloud bulk mark reminders |
| RC-003 | Filtered register CSV export |
| RC-004 | Terminology consistency |
| RC-005 | Stale evidence insight label clarity |
| RC-006 | Message styling consistency |
| RC-007 | Register count scope clarity |
| RC-008 | Renew workflow wording |
| RC-009 | Cloud evidence metadata-only clarity |
| RC-010 | Final hardening summary and release checklist |

**Constraints (V4 to date):** No new CRUD, migrations (except RC-001 `20260203000017`), cloud-write policy changes, or AI/LLM dependency.

Tag: **v4.0.0-rc1** in source; GA target **v4.0.1** (pending sign-off and version bump).

---

## v5.0.0 — Automated Compliance Operations · In progress (alpha)

**Theme:** From insight to action — scheduled reminders, policy-driven action creation, escalations, and auditable operations on the existing cloud platform.

V4 answers *what needs attention*. V5 **acts on it automatically** once the automation platform ships. **V5-1A Contact Management** (v5.0.0-alpha.1) and **V5-1B Reminder Template Preview** (v5.0.0-alpha.2) establish contact fields and read-only reminder preview before delivery.

**Full roadmap:** [`docs/v5-automated-compliance-operations.md`](docs/v5-automated-compliance-operations.md)  
**V5-1A alpha:** [`docs/v5-1a-contact-management.md`](docs/v5-1a-contact-management.md)

**Prerequisites:** v4.0.1 GA, v3.1.0 cloud follow-on (evidence Storage, restore/bulk ops, production cloud-writes policy)

| Slice | Status | Summary |
|-------|--------|---------|
| V5-1A | **COMPLETE** | Contact Management — email fields, Contact Readiness insights, drilldown-to-edit; **v5.0.0-alpha.1** |
| V5-1B | **COMPLETE** | Reminder Template Preview — template, preview UI, copy/export, dashboard; **v5.0.0-alpha.2** |
| V5-0 | **COMPLETE** | Automation platform foundation — schema, RPCs, dry-run scan + audit logging + audit UI; **v5.0.0-alpha.3** |
| V5-1 | **COMPLETE** | Reminder queue foundation — queue, preview UI, CSV export, orchestrator; **v5.0.0-alpha.4** |
| V5-2 | **COMPLETE** | Reminder email template builder — template builder, preview UI, copy template, digest builder, digest preview UI, foundation orchestrator; **v5.0.0-alpha.5**; no delivery |
| V5-2A | **PLANNED** | Automated action orchestration — policies map V4 recommendations → `add_default_actions` |
| V5-3 | **PLANNED** | Escalation & operational closure — missing follow-up → admin notify + audit |
| V5-4 | **PLANNED** | Policy engine GA — templates, dry-run, operations export, `verify:automation` |

**Architecture:** Server-side automation via Supabase Edge Functions + pg_cron; all writes through RPC; history entries tagged `source: automation`. **Cloud-only** — local mode remains manual with clear UI messaging.

**Non-goals:** AI/LLM, third-party DBS APIs, mobile apps, visual workflow builder.

**Alpha tag in source:** v5.0.0-alpha.5  
**GA tag target:** `v5.0.0`

---

## v6.0.0 — Reminder Delivery · Planned

**Theme:** From preparation to auditable delivery — lifecycle, records, provider integration, and operations visibility.

V5 answers *what would be sent*. V6 defines and eventually implements *how sends are tracked and audited*.

**Full architecture:** [`docs/v6-delivery-architecture.md`](docs/v6-delivery-architecture.md)

**Prerequisites:** v5.0.0-alpha.5 (V5-2 template & digest foundation)

| Phase | Status | Summary |
|-------|--------|---------|
| V6-1 Phase 1 | **Complete** | Delivery domain model — lifecycle, record shape, audit, dedup, retry, provider interface; architecture only |
| V6-1 Phase 2 | **Complete** | In-memory delivery record builder (`buildReminderDeliveryRecords`) |
| V6-1 Phase 3 | **Complete** | `reminder_delivery_logs` Postgres schema, RLS, dedup index — no app wiring |
| V6-1 Phase 4 | **Complete** | Delivery log RPC draft — `create_reminder_delivery_log`, `get_reminder_delivery_logs` |
| V6-1 Phase 5 | **COMPLETE** | In-process delivery state machine (`transitionReminderDeliveryRecord`) |
| V6-1 Phase 6 | **COMPLETE** | Mock email provider (`createMockEmailProvider`) |
| V6-1 Phase 7 | **COMPLETE** | Mock delivery executor (`executeMockReminderDelivery`) |
| V6-1 Phase 8 | **COMPLETE** | Delivery foundation verification orchestrator (`verify-delivery-foundation`) |
| V6-1 Phase 9+ | **PLANNED** | Real provider integration, Operations Log UI |

**Verification:** `npm run verify-delivery-foundation` (master gate); individual phase scripts remain available for targeted checks

**Non-goals (Phase 1–2):** Email provider, outbound delivery, mark-as-sent automation, database writes.

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
