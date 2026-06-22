# V6 Automated Email Reminders

**Theme:** Server-side scheduled reminder automation — audit and dry-run foundations before live sends.  
**Phases:** 45 (dry run) · 46 (staging deploy smoke) · 47 (automation run records) · 48 (staging persistence verification) · 49 (delivery log schema) · 50 (staging schema verification) · 51 (dry-run delivery log rows) · 52 (staging delivery log verification) · 53 (email template framework) · 54 (Edge Resend provider foundation) · 55 (provider disabled-mode staging verification) · 56 (controlled manual test-send)  
**Date:** June 2026

---

## Executive summary

V6 automated email reminders progress in safe, auditable slices. Phase 45–46 established `scheduled-reminder-runner` as a **dry-run-only** Edge Function that returns candidate summary counts. Phase 47 adds a **read-only audit layer**: each successful dry-run invoke persists one `automation_runs` row via service role — still **no emails** and **no mark-as-sent**. Phase 49 adds the **Postgres schema** for per-recipient delivery logging. Phase 50 confirms that schema on live staging via catalog introspection. Phase 51 persists **dry-run delivery log rows** (`pending` / `skipped` only) linked to each automation run — still **no Resend**, **no email sends**, and **no mark-as-sent**. Phase 52 verifies on live staging that those delivery log rows are created and linked to the returned `automationRunId`. Phase 53 adds a **plain-text email template framework** (subject, body, token replacement, preview) for future scheduled sends — **template/preview only**, still no Resend or delivery. Phase 54 adds a **shared Edge email provider module** (configuration, provider abstraction, safety gates) — **disabled by default**, still no scheduled-runner send path or delivery writes. Phase 55 verifies on live staging that the deployed provider remains disabled — **no real email sends**, still no scheduled-runner wiring. Phase 56 adds a **manual only** `send-test-email` Edge Function — one allowlisted test send when explicitly enabled, still no scheduled-runner wiring and **no delivery log writes**.

| Phase | Scope | Writes |
|-------|-------|--------|
| 45 | Dry-run candidate scan | None |
| 46 | Staging deploy + manual smoke | None |
| 47 | `automation_runs` audit row per dry run | `automation_runs` insert only (service role) |
| 48 | Staging verification for `automation_runs` persistence | None (live verify script) |
| 49 | `reminder_delivery_logs` schema for future sends | None (schema migration only) |
| 50 | Staging verification for `reminder_delivery_logs` schema | None (live catalog verify script) |
| 51 | Dry-run delivery log rows per candidate | `reminder_delivery_logs` insert (`pending` / `skipped` only) |
| 52 | Staging verification for dry-run delivery logs | None (live verify script) |
| 53 | Plain-text email template framework | None (template generation only) |
| 54 | Edge Resend provider foundation (disabled by default) | None (provider module only) |
| 55 | Provider disabled-mode staging verification | None (live verify script) |
| 56 | Controlled manual test-send (`send-test-email`) | None (manual invoke only; no delivery logs) |

---

## Phase 56 — Controlled manual test-send function

**Status:** Complete when `npm run verify-send-test-email-function` and `npm run verify-send-test-email-disabled-staging` pass.

**Goal:** Add a **dedicated manual** Edge Function that can send exactly one controlled test email through the provider to an **allowlisted** recipient. **Manual only** — `scheduled-reminder-runner` remains disconnected, no bulk sends, no reminder candidate sends, no `mark_reminder_sent`, no compliance mutation, and no `reminder_delivery_logs` or `automation_runs` writes in this phase.

### Deliverables

| Item | Location |
|------|----------|
| Manual test-send Edge Function | `supabase/functions/send-test-email/index.ts` |
| Static verification gate | `scripts/verify-send-test-email-function.mjs` |
| Disabled-mode staging gate | `scripts/verify-send-test-email-disabled-staging.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Deploy before staging verification

```powershell
supabase functions deploy send-test-email --project-ref vmrotpztwoeifbdjwdis
```

### Request contract

POST with Authorization (authenticated user required). JSON body:

```json
{
  "to": "verified-test-recipient@example.com",
  "subject": "Compliance Reminder System test email",
  "bodyText": "This is a controlled test email."
}
```

### Safety rules

| Rule | Enforcement |
|------|-------------|
| Recipient allowlist | `TEST_EMAIL_ALLOWLIST` comma-separated env var; reject if `to` missing or not listed |
| Sending gate | `EMAIL_SENDING_ENABLED=true` required |
| Provider config | `RESEND_API_KEY` and `EMAIL_FROM_ADDRESS` required when sending enabled |
| Single send | Exactly one `sendReminderEmail` call per invoke |
| No audit writes | No `reminder_delivery_logs`, `automation_runs`, `mark_reminder_sent`, or `sent_at` writes |

### Verification flow (disabled staging)

1. Signs in as staging admin (JWT for Edge Function invoke)
2. Records `reminder_delivery_logs` and `automation_runs` row count baselines
3. Invokes `send-test-email` while `EMAIL_SENDING_ENABLED` is false
4. Asserts HTTP 403 with `status: refused`, `reason: email_sending_disabled`
5. Asserts no `providerMessageId` or `sent_at` in response
6. Asserts row counts unchanged
7. Asserts `scheduled-reminder-runner` does not import `email-provider`

### Hard constraints

- Manual test function only — no scheduled-runner email sending
- Recipient allowlist required (`TEST_EMAIL_ALLOWLIST`)
- No delivery log writes in this phase
- `RESEND_API_KEY` not required for disabled-mode staging verification
- No app UI changes

### Verification

```powershell
npm run verify-send-test-email-function
npm run verify-send-test-email-disabled-staging
npm run build
```

**Phase 56 gate:** `npm run verify-send-test-email-function` must pass; `npm run verify-send-test-email-disabled-staging` must pass against staging.

**Next slice:** TBD — wire provider into scheduled-reminder-runner send path (out of Phase 56 scope).

---

## Phase 55 — Provider disabled-mode staging verification

**Status:** Complete when `npm run verify-email-provider-disabled-staging` passes against staging.

**Goal:** Confirm the **deployed** Edge runtime keeps email sending **disabled by default**. A temporary verification Edge Function calls `sendReminderEmail` with harmless fake input and returns a safe disabled result — **no Resend HTTP calls**, no `delivery_status` changes, no `sent_at` or `provider_message_id` writes, no `mark_reminder_sent`, and no `scheduled-reminder-runner` wiring.

### Deliverables

| Item | Location |
|------|----------|
| Staging verification Edge Function | `supabase/functions/verify-email-provider-disabled/index.ts` |
| Staging verification gate | `scripts/verify-email-provider-disabled-staging.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Deploy before staging verification

```powershell
supabase functions deploy verify-email-provider-disabled --project-ref vmrotpztwoeifbdjwdis
```

### Verification flow

1. Signs in as staging admin (JWT for Edge Function invoke)
2. Records `reminder_delivery_logs` row count baseline
3. Invokes `verify-email-provider-disabled` (POST, Authorization required)
4. Asserts `status: ok`, `mode: provider_disabled_verification`, `emailProviderStatus: disabled`
5. Asserts no `providerMessageId` or `sent_at` in response; `providerResult.status` is `disabled`
6. Asserts `reminder_delivery_logs` row count unchanged
7. Asserts `scheduled-reminder-runner` does not import `email-provider` or call `sendReminderEmail`

### Hard constraints

- Staging verification only — no real email sending
- `RESEND_API_KEY` not required when `EMAIL_SENDING_ENABLED` is false
- No `scheduled-reminder-runner` behaviour changes
- No app UI changes

### Verification

```powershell
npm run verify-email-provider-disabled-staging
npm run build
```

**Phase 55 gate:** `npm run verify-email-provider-disabled-staging` must pass against staging.

**Next slice:** TBD — wire provider into scheduled-reminder-runner send path (out of Phase 55 scope).

---

## Phase 54 — Edge Resend provider foundation (disabled by default)

**Status:** Complete when `npm run verify-resend-provider-foundation` passes.

**Goal:** Add the **foundation** for Resend email provider integration on the Edge runtime without sending any emails yet. **Provider abstraction and safety gates only** — no scheduled-runner send path, no delivery status changes, no `mark_reminder_sent`, and no `sent_at` or `provider_message_id` writes.

### Deliverables

| Item | Location |
|------|----------|
| Edge shared provider module | `supabase/functions/_shared/email-provider.ts` |
| Verification gate | `scripts/verify-resend-provider-foundation.mjs` |
| Browser foundation orchestrator (Phase 20) | `scripts/verify-browser-resend-provider-foundation.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Exported API

| Function | Purpose |
|----------|---------|
| `getEmailProviderConfig(env)` | Parse `RESEND_API_KEY`, `EMAIL_SENDING_ENABLED`, `EMAIL_FROM_ADDRESS`, `EMAIL_PROVIDER` |
| `isEmailSendingEnabled(config)` | Returns `true` only when `EMAIL_SENDING_ENABLED` is explicitly enabled |
| `createEmailProvider(config)` | Provider factory (Resend scaffold) |
| `sendReminderEmail(input, config?)` | Safe send entry point — returns disabled result when sending is off |

### Configuration

| Variable | Default | Required when sending disabled | Required when sending enabled |
|----------|---------|-------------------------------|------------------------------|
| `EMAIL_SENDING_ENABLED` | `false` | No | Yes (`true`) |
| `EMAIL_PROVIDER` | `resend` | No | No |
| `RESEND_API_KEY` | — | No | Yes |
| `EMAIL_FROM_ADDRESS` | — | No | Yes |

### Hard constraints

- `RESEND_API_KEY` must not be required for build or local verification
- Email sending disabled by default — `sendReminderEmail` must not call Resend unless `EMAIL_SENDING_ENABLED=true`
- `scheduled-reminder-runner` must not import the provider module or call Resend
- Only `verify-email-provider-disabled` may call `sendReminderEmail` (Phase 55 staging gate); `scheduled-reminder-runner` must not
- No `delivery_status` `sent` writes, `sent_at`, `provider_message_id` DB writes, or `mark_reminder_sent`
- No app UI changes
- No live Resend calls in verification

### Verification

```powershell
npm run verify-resend-provider-foundation
npm run build
```

**Phase 54 gate:** `npm run verify-resend-provider-foundation` must pass.

**Next slice:** TBD — wire provider into scheduled-reminder-runner send path (out of Phase 54 scope).

---

## Phase 53 — Reminder email template framework

**Status:** Complete when `npm run verify-reminder-email-template` passes.

**Goal:** Provide a safe, reusable **plain-text** email template layer for future scheduled reminder sends. **Template/preview only** — no Resend, no email sending, no delivery status changes, no `mark_reminder_sent`, and no `sent_at` or `provider_message_id` writes.

### Deliverables

| Item | Location |
|------|----------|
| Template module | `js/app/automation/reminder-email-template.js` |
| Verification gate | `scripts/verify-reminder-email-template.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Exported API

| Function | Purpose |
|----------|---------|
| `buildReminderEmailSubject(candidate, options)` | Plain-text subject line |
| `buildReminderEmailBody(candidate, options)` | Plain-text body |
| `buildReminderEmailPreview(candidate, options)` | `{ subject, bodyText }` |
| `replaceReminderEmailTokens(template, tokens)` | `{{token}}` replacement helper |
| `buildReminderEmailTokenMap(candidate, options)` | Resolved token values with fallbacks |

### Supported tokens

`{{recipientName}}` · `{{personName}}` · `{{complianceType}}` · `{{reminderType}}` · `{{dueDate}}` · `{{organisationName}}` · `{{contactName}}`

Missing values use sensible fallbacks (e.g. `there`, `team member`, `compliance item`, `date not set`). Subject `dueDate` uses ISO `YYYY-MM-DD`; body `dueDate` uses en-GB long format (e.g. `22 July 2026`).

### Example output

**Subject:** `Reminder: DBS expires on 2026-07-22`

**Body:**

```text
Hello Sarah,

This is a reminder that John Smith's DBS is due to expire on 22 July 2026.

Please arrange renewal or update the compliance record once complete.

Thank you,
Alpha Test Organisation
```

### Hard constraints

- No Resend or email provider imports
- No `fetch`, SMTP, or send helpers
- No database writes or RPC calls
- No `mark_reminder_sent`, `sent_at`, or `provider_message_id` logic
- No HTML templates yet
- No Edge Function or scheduled-runner wiring in this phase

### Verification

```powershell
npm run verify-reminder-email-template
npm run build
```

**Phase 53 gate:** `npm run verify-reminder-email-template` must pass.

**Next slice:** V6 Phase 54 — Edge Resend provider foundation (complete).

---

## Phase 52 — Staging verification for dry-run delivery logs

**Status:** Complete when `npm run verify-scheduled-runner-delivery-log-dry-run-staging` passes against staging.

**Goal:** Confirm the **deployed** `scheduled-reminder-runner` on staging creates `reminder_delivery_logs` rows linked to the returned `automationRunId` after each dry-run invoke. **Verification only** — no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes.

### Prerequisites

| Requirement | Detail |
|-------------|--------|
| Staging project | `vmrotpztwoeifbdjwdis` |
| Migration | Phase 49 `reminder_delivery_logs` schema applied |
| Edge Function | `scheduled-reminder-runner` deployed with Phase 51 delivery log writes |
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TEST_PASSWORD` |

Default organisation: Alpha Test Organisation `11111111-1111-1111-1111-111111111111`.

Optional: `SCHEDULED_RUNNER_AS_OF_DATE=YYYY-MM-DD` to pin the scan date.

### Deliverables

| Item | Location |
|------|----------|
| Staging verification gate | `scripts/verify-scheduled-runner-delivery-log-dry-run-staging.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Verification script checks

1. Signs in as staging admin (JWT for Edge Function invoke)
2. POSTs `functions/v1/scheduled-reminder-runner` with `organisationId`
3. Asserts `status: "ok"`, `mode: "dry_run"`, `automationRunId`, and `deliveryLogSummary`
4. Queries `reminder_delivery_logs` by `automation_run_id` (service role)
5. Asserts row counts match `deliveryLogSummary` (`total`, `pending`, `skipped`; `sent` and `failed` are `0`)
6. Asserts no row has `sent_at` or `provider_message_id`; every row has `provider` null and `payload.mode = "dry_run"`
7. Asserts every row `organisation_id` matches the request
8. Asserts matching `automation_runs` row still exists

**Out of scope for Phase 52:** Resend calls, real email delivery, `mark_reminder_sent`, compliance/history mutation checks.

### Verification

```powershell
npm run verify-scheduled-runner-delivery-log-dry-run-staging
```

**Phase 52 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run-staging` must pass against staging.

**Next slice:** TBD — live scheduled email sends (out of Phase 52 scope).

---

## Phase 51 — Dry-run delivery log creation

**Status:** Complete when `npm run verify-scheduled-runner-delivery-log-dry-run` passes.

**Goal:** Extend `scheduled-reminder-runner` dry-runs to create one `reminder_delivery_logs` row per candidate after the `automation_runs` insert. **Dry-run only** — no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes.

### Flow

1. Compute dry-run candidates
2. Insert `automation_runs` row (Phase 47)
3. Insert `reminder_delivery_logs` rows linked via `automation_run_id` (Phase 51)
4. Return `automationRunId` and `deliveryLogSummary`

**Not transactional:** If step 3 fails, the automation run from step 2 may already exist. HTTP **500** with `error: "delivery_log_persist_failed"`.

### Deliverables

| Item | Location |
|------|----------|
| Edge Function insert path | `supabase/functions/scheduled-reminder-runner/index.ts` |
| Verification gate | `scripts/verify-scheduled-runner-delivery-log-dry-run.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Delivery log row rules (Phase 51)

| Field | Rule |
|-------|------|
| `delivery_status` | `pending` when candidate has email; `skipped` when missing email |
| `provider`, `provider_message_id` | `null` |
| `sent_at` | Not set |
| `payload` | `{ mode: "dry_run", reason, asOfDate, …candidate snapshot }` |

### Response `deliveryLogSummary`

| Field | Meaning |
|-------|---------|
| `total` | Rows inserted (one per candidate) |
| `pending` | Candidates with email |
| `skipped` | Candidates without email |
| `failed` | Always `0` |
| `sent` | Always `0` |

### Hard constraints

- No Resend API calls
- No `send-reminder-deliveries` invocation
- No `mark_reminder_sent` or `sent_at` mutation
- `scheduled-reminder-runner` remains `dry_run` mode only
- No app UI changes

### Verification

```powershell
npm run verify-scheduled-runner-delivery-log-dry-run
npm run build
```

**Phase 51 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run` must pass.

**Next slice:** V6 Phase 52 — staging verification for dry-run delivery logs (complete).

---

## Phase 51 — Dry-run delivery log creation

**Status:** Complete when `npm run verify-reminder-delivery-log-schema-staging` passes against staging.

**Goal:** Confirm the Phase 49 delivery log migration is applied on the live staging database. **Verification only** — no Edge Function writes, Resend, mark-as-sent, or app behaviour changes.

### Deliverables

| Item | Location |
|------|----------|
| Staging verification gate | `scripts/verify-reminder-delivery-log-schema-staging.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### Environment

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `SUPABASE_URL` | Yes | Staging project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | PostgREST shape checks |
| `SUPABASE_ACCESS_TOKEN` | No* | Catalog SQL via Management API |
| `SUPABASE_ANON_KEY` | No | Optional authenticated RLS posture checks |
| `SUPABASE_TEST_PASSWORD` | No | Optional admin sign-in for RLS posture checks |

\*Catalog introspection uses `SUPABASE_ACCESS_TOKEN` when set, otherwise the Supabase CLI access token from `supabase login`.

### What the script checks

- `public.reminder_delivery_logs` exists with Phase 49 columns (Phase 3 foundation columns absent)
- `delivery_status` check constraint allows `pending`, `sent`, `skipped`, `failed`
- Expected indexes exist, including partial `provider_message_id` predicate
- RLS enabled; `reminder_delivery_logs_org_select` scopes to `current_organisation_id()`
- No authenticated insert/update/delete policies
- `automation_run_id` FK references `automation_runs.automation_run_id`
- PostgREST column/FK relationship checks (service role)
- Optional authenticated SELECT allowed / INSERT denied (when anon key + test password configured)

### What Phase 50 does not check

- `reminder_delivery_logs` writes from Edge Functions
- Resend or email delivery
- `mark_reminder_sent` / `sent_at` mutation
- `scheduled-reminder-runner` behaviour beyond schema prerequisites

### Verification

```powershell
npm run verify-reminder-delivery-log-schema-staging
```

**Phase 50 gate:** must pass against staging (`vmrotpztwoeifbdjwdis`) after Phase 49 migration is applied.

**Next slice:** V6 Phase 51 — dry-run delivery log creation (complete).

---

## Phase 50 — Staging verification for reminder_delivery_logs schema

**Status:** Complete when `npm run verify-reminder-delivery-log-schema` passes.

**Goal:** Add the database foundation for future scheduled email delivery logging. **Schema and verification only** — no Edge Function writes, no Resend, no mark-as-sent, and no connection from `scheduled-reminder-runner` to delivery logs.

### Deliverables

| Item | Location |
|------|----------|
| Schema migration | `supabase/migrations/20260401000009_reminder_delivery_logs_scheduled_send_schema.sql` |
| Verification gate | `scripts/verify-reminder-delivery-log-schema.mjs` |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### `reminder_delivery_logs` columns (Phase 49)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key |
| `organisation_id` | `uuid` | Required; FK to `organisations` |
| `automation_run_id` | `uuid` | FK to `automation_runs.automation_run_id` |
| `compliance_record_id` | `uuid` | FK to `compliance_records` |
| `person_id` | `uuid` | FK to `people` |
| `recipient_email` | `text` | Nullable (skipped / missing-email rows) |
| `recipient_name` | `text` | |
| `compliance_type` | `text` | |
| `reminder_type` | `text` | |
| `due_date` | `date` | |
| `delivery_status` | `text` | Default `pending`; `pending`, `sent`, `skipped`, or `failed` |
| `provider` | `text` | Nullable until live sends |
| `provider_message_id` | `text` | |
| `error_code` | `text` | |
| `error_message` | `text` | |
| `payload` | `jsonb` | Default `{}` |
| `created_at` | `timestamptz` | Default `now()` |
| `sent_at` | `timestamptz` | Nullable until sends are implemented |

**Indexes:** `organisation_id`, `automation_run_id`, `compliance_record_id`, `delivery_status`, `created_at desc`, partial `provider_message_id` where not null.

### RLS

- **Select:** Authenticated users may read rows for `organisation_id = current_organisation_id()`.
- **Insert / update / delete:** No authenticated policies — server-side only (service role bypasses RLS).

### Hard constraints (unchanged from Phase 45–48)

- No Resend API calls from `scheduled-reminder-runner`
- No `mark_reminder_sent` or `sent_at` mutation from `scheduled-reminder-runner`
- `scheduled-reminder-runner` remains dry-run only (Phase 51 adds dry-run delivery log rows only)
- No app behaviour changes

### Verification

```powershell
npm run verify-reminder-delivery-log-schema
npm run build
```

`verify-reminder-delivery-log-schema` checks:

1. Phase 49 migration exists and creates `reminder_delivery_logs`
2. All expected columns, `delivery_status` constraint, and indexes
3. RLS enabled with org-scoped select only (no client write policies)
4. `scheduled-reminder-runner` safety gates — dry-run only, no Resend / mark-as-sent / `sent_at` (Phase 51 delivery log writes allowed)

**Next slice:** V6 Phase 50 — staging verification for `reminder_delivery_logs` schema.

---

## Phase 47 — Automation run records for scheduled runner dry-runs

**Status:** Complete when `npm run verify-automation-run-records` passes.

**Goal:** Persist an immutable audit record when `scheduled-reminder-runner` completes a valid dry-run scan. The record captures what **would** have happened without sending email or mutating reminder state.

### Deliverables

| Item | Location |
|------|----------|
| Schema extension | `supabase/migrations/20260401000008_automation_runs_scheduled_dry_run.sql` |
| Edge Function insert | `supabase/functions/scheduled-reminder-runner/index.ts` |
| Verification gate | `scripts/verify-automation-run-records.mjs` |
| Scheduled runner contract | [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) |
| Architecture cross-reference | [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) |

### `automation_runs` columns (Phase 47)

Extends the V5 foundation table (`20260401000002_automation_runs.sql`):

| Column | Type | Notes |
|--------|------|-------|
| `automation_run_id` | `uuid` unique | Returned to callers as `automationRunId` |
| `run_type` | `text` | Default `scheduled_reminder_dry_run` |
| `mode` | `text` | Default `dry_run` |
| `status` | `text` | `completed` on successful dry run |
| `as_of_date` | `date` | Candidate scan date |
| `total_candidates` | `integer` | Mirror of `summary.totalCandidates` |
| `with_email` | `integer` | Mirror of `summary.withEmail` |
| `missing_email` | `integer` | Mirror of `summary.missingEmail` |
| `would_send` | `integer` | Mirror of `summary.wouldSend` |
| `would_skip` | `integer` | Mirror of `summary.wouldSkip` |
| `summary` | `jsonb` | `{ totalCandidates, withEmail, missingEmail, wouldSend, wouldSkip }` |

**Indexes:** `organisation_id` (foundation), `automation_run_id`, `created_at desc`.

### RLS and insert path

- **Select:** Existing `automation_runs_member_select` policy — admin + editor read for their organisation.
- **Insert:** Service role in `scheduled-reminder-runner` only (bypasses RLS). No new authenticated insert policy for scheduled dry runs.
- **Update/delete:** Not exposed to normal client users.

### HTTP response (after Phase 47)

```json
{
  "status": "ok",
  "mode": "dry_run",
  "asOfDate": "2026-06-22",
  "organisationId": "<org-uuid>",
  "automationRunId": "<automation-run-uuid>",
  "summary": {
    "totalCandidates": 5,
    "withEmail": 3,
    "missingEmail": 2,
    "wouldSend": 3,
    "wouldSkip": 2
  }
}
```

`automationRunId` is the `automation_run_id` value from the inserted row — not invented before insert.

### Insert failure behaviour

If the `automation_runs` insert fails, the function returns **HTTP 500** with a structured error (`automation_run_persist_failed`). It does **not** return `status: "ok"` without a persisted row.

### Hard constraints (unchanged from Phase 45–46)

- No Resend API calls
- No `send-reminder-deliveries` invoke
- No `reminder_delivery_logs` writes
- No `mark_reminder_sent` or `sent_at` mutation
- No production reminder logic changes
- Dry-run mode only

### Verification

```powershell
npm run verify-automation-run-records
npm run build
```

`verify-automation-run-records` checks:

1. Phase 47 migration exists and extends `automation_runs`
2. RLS documented in foundation migration
3. Service-role insert path in `scheduled-reminder-runner`
4. Response includes `automationRunId`
5. Forbidden patterns absent (Resend, mark-as-sent, delivery logs, reminder mutation)

### Related documentation

- [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) — Edge Function contract and staging smoke
- [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) — full V6 delivery phase map

**Next slice:** TBD — scheduled delivery execution (out of Phase 47 scope).

---

## Phase 48 — Staging verification for automation_runs persistence

**Status:** Complete when `npm run verify-scheduled-runner-automation-run-staging` passes against staging.

**Goal:** Live staging proof that `scheduled-reminder-runner` dry-run invokes persist one `automation_runs` row and return the matching `automationRunId`.

### Deliverables

| Item | Location |
|------|----------|
| Staging verification gate | `scripts/verify-scheduled-runner-automation-run-staging.mjs` |
| Scheduled runner docs | [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) § Phase 48 |

### Environment (`.env`)

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `SUPABASE_URL` | Yes | Staging project URL |
| `SUPABASE_ANON_KEY` | Yes | Edge Function invoke (`apikey` header) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Query `automation_runs` by `automation_run_id` |
| `SUPABASE_TEST_PASSWORD` | Yes | Admin sign-in for JWT |
| `SUPABASE_TEST_ORGANISATION_ID` | No | Defaults to Alpha org `11111111-1111-1111-1111-111111111111` |
| `SCHEDULED_RUNNER_AS_OF_DATE` | No | Optional pinned `asOfDate` for invoke |

### What the script checks

- HTTP 200, `status: "ok"`, `mode: "dry_run"`, `automationRunId` UUID
- Exactly one `automation_runs` row for `automation_run_id = automationRunId`
- Row `organisation_id`, `run_type`, `mode`, `status` match expected values
- `summary` JSONB and dedicated counter columns match response `summary`

### What Phase 48 does not check

- `reminder_delivery_logs` writes
- `mark_reminder_sent` / `sent_at` mutation
- Resend or email delivery

### Verification

```powershell
npm run verify-scheduled-runner-automation-run-staging
```

**Phase 48 gate:** must pass against deployed staging (`vmrotpztwoeifbdjwdis`) after Phase 47 migration + function deploy.

**Next slice:** TBD — scheduled delivery execution (out of Phase 48 scope).

---

## Phase 46 — Deploy and smoke-test scheduled runner dry run

See [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) § Phase 46.

**Next slice:** V6 Phase 47 — automation run records (complete).

---

## Phase 45 — Scheduled automation runner dry run

See [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md).

**Next slice:** V6 Phase 46 — deploy and smoke-test.
