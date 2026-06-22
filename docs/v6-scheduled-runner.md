# V6 Scheduled Automation Runner

**Theme:** Server-side structure for scheduled reminder automation — candidate identification only.  
**Phases:** 45 (dry run implementation) · 46 (staging deploy + smoke test) · 47 (automation run records) · 48 (staging persistence verification) · 51 (dry-run delivery log rows) · 59 (live-send gate — refused by default) · 60 (live-send preview — metadata only, no emails)  
**Date:** June 2026

---

## Executive summary

Phase 45 adds `scheduled-reminder-runner`, a Supabase Edge Function that scans an organisation's compliance data and returns the same reminder **candidates** as the admin **Manual Delivery Test** queue preview. Phase 46 deploys that function to **staging** and documents a **manual dry-run smoke test** — still no automatic sends, no cron, and no production mode changes.

| Today (Phase 45–48, 51, 59, 60) | Future (out of scope) |
|-----------------------------|----------------------|
| Dry-run candidate scan via Edge Function | Cron / pg_cron schedule |
| Staging deploy + manual smoke test | Automatic Resend sends |
| `automation_runs` + `reminder_delivery_logs` dry-run audit rows | Live `sent` / `failed` delivery statuses |
| Explicit `mode` gate (`dry_run` default; `live_send` refused) | Test-mode mark-as-sent from scheduler |
| `live_send_preview` — email subject/body metadata only (no sends) | |
| JWT + RLS read paths | Invoke `send-reminder-deliveries` from scheduler |
| Same window rules as Manual Delivery Test | |

---

## Edge Function: `scheduled-reminder-runner`

**Path:** `supabase/functions/scheduled-reminder-runner/index.ts`

### Authentication

- `POST` only (plus `OPTIONS` for CORS)
- Requires `Authorization` header (caller JWT — same pattern as `send-reminder-deliveries`)
- Uses anon key + forwarded JWT; RLS scopes reads to the caller's organisation membership

### Request body

```json
{
  "organisationId": "uuid",
  "asOfDate": "2026-06-22",
  "mode": "dry_run"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `organisationId` | Yes | Organisation to scan |
| `asOfDate` | No | ISO date (`YYYY-MM-DD`); defaults to today at local midnight |
| `mode` | No | `"dry_run"` (default), `"live_send"` (Phase 61 — allowlisted sends when gates enabled), or `"live_send_preview"` (Phase 60 — preview metadata only) |

### Response body (dry run)

```json
{
  "status": "ok",
  "mode": "dry_run",
  "asOfDate": "2026-06-22",
  "organisationId": "uuid",
  "automationRunId": "uuid",
  "summary": {
    "totalCandidates": 5,
    "withEmail": 3,
    "missingEmail": 2,
    "wouldSend": 3,
    "wouldSkip": 2
  },
  "deliveryLogSummary": {
    "total": 5,
    "pending": 3,
    "skipped": 2,
    "failed": 0,
    "sent": 0
  }
}
```

| Summary field | Meaning |
|---------------|---------|
| `totalCandidates` | Records in an active reminder window (30 / 14 / 7 day or expired) |
| `withEmail` | Candidates with a recipient email |
| `missingEmail` | Candidates without a recipient email |
| `wouldSend` | Same as `withEmail` — records that would be attempted in a future send phase |
| `wouldSkip` | Same as `missingEmail` — records that would be skipped for missing email |

| `deliveryLogSummary` field | Meaning |
|----------------------------|---------|
| `total` | Delivery log rows inserted (one per candidate) |
| `pending` | Rows with email — would send in a future live phase |
| `skipped` | Rows without email |
| `failed` | Always `0` in Phase 51 |
| `sent` | Always `0` in Phase 51 |

**Parity:** Candidate detection matches `buildReminderQueuePreviewData()` in `app.js` → `computeAutomationDryRun` + `buildReminderQueueFromDryRun`. Client helper: `js/app/automation/scheduled-runner-candidates.js`.

### Error responses

| Status | `error` | Cause |
|--------|---------|-------|
| 401 | `unauthorized` | Missing/invalid Authorization |
| 400 | `invalid_json` | Malformed JSON body |
| 400 | `organisationId is required` | Missing organisation |
| 405 | `method_not_allowed` | Non-POST request |
| 500 | `settings_load_failed` | Could not read `reminder_settings` |
| 500 | `compliance_load_failed` | Could not read `people` / `compliance_records` |
| 500 | `automation_run_persist_failed` | Could not insert `automation_runs` audit row (Phase 47) |
| 500 | `delivery_log_persist_failed` | Could not insert `reminder_delivery_logs` rows (Phase 51); `automationRunId` may be present in error body |
| 500 | `service_unavailable` | Service role client unavailable for audit insert |
| 409 | — | `live_send` refused — see **Phase 59** (`status: "refused"`) |
| 400 | `invalid_mode` | `mode` is not `dry_run`, `live_send`, or `live_send_preview` |

### Response fields

| Field | Required | Notes |
|-------|----------|-------|
| `status` | Yes | `"ok"` on success |
| `mode` | Yes | `"dry_run"` |
| `asOfDate` | Yes | ISO date used for candidate scan |
| `organisationId` | Yes | Organisation scanned |
| `automationRunId` | Yes (Phase 47+) | `automation_runs.automation_run_id` from persisted audit row |
| `summary` | Yes | Candidate counts (see table above) |
| `deliveryLogSummary` | Yes (Phase 51+) | Per-candidate delivery log insert counts |

---

## Safety constraints (Phase 45–48, 51)

| Guard | Behaviour |
|-------|-----------|
| Resend / SMTP | **Not called** |
| `send-reminder-deliveries` | **Not invoked** |
| `reminder_delivery_logs` | **Dry-run rows only** (Phase 51) — `pending` / `skipped`, no `sent_at` |
| `mark_reminder_sent` | **Not called** |
| Compliance / history mutation | **None** |
| `automation_runs` | **Audit insert** (Phase 47) — service role, one row per successful dry run |
| Production `EMAIL_MODE` | **Unchanged** — runner needs no email secrets |
| Cron / scheduler | **Not deployed** — manual invocation only in Phase 46 |

---

## Preflight commands

Run from the repository root **before** deploying the Edge Function:

```powershell
npm run build
npm run verify-scheduled-runner-dry-run
npm run verify-scheduled-runner-deploy-smoke
```

| Command | Purpose |
|---------|---------|
| `npm run build` | Fresh `app.bundle.js` |
| `npm run verify-scheduled-runner-dry-run` | Phase 45 gate — structure, parity, static safety |
| `npm run verify-scheduled-runner-deploy-smoke` | Phase 46 gate — deploy/smoke docs, then runs build + Phase 45 gate |

**Phase 45 gate:** `npm run verify-scheduled-runner-dry-run` must pass.  
**Phase 46 gate:** `npm run verify-scheduled-runner-deploy-smoke` must pass.

---

## Phase 46 — Deploy and smoke-test dry run

**Goal:** Deploy `scheduled-reminder-runner` to **staging** and manually invoke it as **dry run only** — summary counts, no side effects.

### Constraints (Phase 46)

| Rule | Detail |
|------|--------|
| **Dry run only** | Response `mode` must be `"dry_run"` — no send path |
| **No Resend** | Function has no email provider code or secrets |
| **No `send-reminder-deliveries`** | Scheduler does not chain to delivery function |
| **Dry-run delivery log rows only** | `reminder_delivery_logs` rows with `pending` / `skipped` — no live sends (Phase 51) |
| **No mark-as-sent** | `mark_reminder_sent` not called |
| **No compliance/history mutation** | Register and history rows unchanged |
| **No cron schedule** | Manual invocation only — do not add pg_cron or Dashboard schedule |

### Deployment checklist

| # | Step | Pass |
|---|------|:----:|
| D.1 | Staging project linked: `supabase link --project-ref vmrotpztwoeifbdjwdis` | ☐ |
| D.2 | Preflight commands pass (see **Preflight commands** above) | ☐ |
| D.3 | Deploy Edge Function (exact command below) | ☐ |
| D.4 | Confirm function in Supabase Dashboard → **Edge Functions** → `scheduled-reminder-runner` | ☐ |
| D.5 | **No cron** — function has no schedule attached | ☐ |
| D.6 | Manual dry-run invoke returns `status: "ok"` and `mode: "dry_run"` | ☐ |
| D.7 | `reminder_delivery_logs` (Phase 51) | **New rows** linked to `automationRunId`; `delivery_status` is `pending` or `skipped` only | ☐ |
| D.8 | Compliance register and history unchanged | ☐ |

### Deploy command (staging)

```powershell
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

**No Edge Function secrets required** for Phase 46 — the runner only reads `people`, `compliance_records`, and `reminder_settings` via the caller's JWT. Do **not** set `RESEND_API_KEY` or `EMAIL_MODE` for this function.

For local function development:

```powershell
supabase functions serve scheduled-reminder-runner
```

---

## Manual invocation

Use an **admin user's access token** (JWT). The token must belong to a user with organisation membership so RLS can read compliance data. **Never commit JWTs or paste them into git.**

### Option A — Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project **vmrotpztwoeifbdjwdis**
2. Go to **Edge Functions** → `scheduled-reminder-runner`
3. Open **Test** / **Invoke** (if available in your CLI version)
4. Method: **POST**
5. Headers: `Authorization: Bearer <access_token>` (paste a short-lived token from a signed-in staging admin — see Option B step 1)
6. Body:

```json
{
  "organisationId": "<your-org-uuid>"
}
```

7. Confirm HTTP **200** and response `mode: "dry_run"`

### Option B — PowerShell (staging)

Read credentials from local `.env` (see `.env.example`). Sign in, then invoke the function. Replace `<ORG_UUID>` with your organisation id from `profiles.organisation_id` (Table Editor or app after sign-in).

```powershell
# 1) Load non-secret values from .env (do not echo passwords or tokens)
$envFile = Get-Content .env
$supabaseUrl = ($envFile | Where-Object { $_ -match '^SUPABASE_URL=' }) -replace '^SUPABASE_URL=',''
$anonKey = ($envFile | Where-Object { $_ -match '^SUPABASE_ANON_KEY=' }) -replace '^SUPABASE_ANON_KEY=',''
$email = ($envFile | Where-Object { $_ -match '^SUPABASE_TEST_EMAIL=' }) -replace '^SUPABASE_TEST_EMAIL=',''
$password = ($envFile | Where-Object { $_ -match '^SUPABASE_TEST_PASSWORD=' }) -replace '^SUPABASE_TEST_PASSWORD=',''

# 2) Sign in — obtain access_token (short-lived; do not log or commit)
$auth = Invoke-RestMethod `
  -Method Post `
  -Uri "$supabaseUrl/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $anonKey; "Content-Type" = "application/json" } `
  -Body (@{ email = $email; password = $password } | ConvertTo-Json)

$token = $auth.access_token

# 3) Dry-run invoke
$body = @{ organisationId = "<ORG_UUID>" } | ConvertTo-Json
Invoke-RestMethod `
  -Method Post `
  -Uri "$supabaseUrl/functions/v1/scheduled-reminder-runner" `
  -Headers @{
    Authorization = "Bearer $token"
    apikey = $anonKey
    "Content-Type" = "application/json"
  } `
  -Body $body
```

### Option C — curl

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/scheduled-reminder-runner" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organisationId":"<ORG_UUID>"}'
```

Obtain `$ACCESS_TOKEN` via the auth endpoint or browser DevTools → Application → session after signing in as staging admin. **Do not commit tokens.**

---

## Expected dry-run response

HTTP **200** with JSON:

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
  },
  "deliveryLogSummary": {
    "total": 5,
    "pending": 3,
    "skipped": 2,
    "failed": 0,
    "sent": 0
  }
}
```

| Field | Required | Meaning |
|-------|:--------:|---------|
| `status` | Yes | Must be `"ok"` on success |
| `mode` | Yes | Must be `"dry_run"` |
| `automationRunId` | Yes | UUID from inserted `automation_runs` row (Phase 47) |
| `summary.totalCandidates` | Yes | Records in an active reminder window |
| `summary.withEmail` | Yes | Candidates with recipient email |
| `summary.missingEmail` | Yes | Candidates without email |
| `summary.wouldSend` | Yes | Same as `withEmail` |
| `summary.wouldSkip` | Yes | Same as `missingEmail` |
| `deliveryLogSummary.total` | Yes (Phase 51) | Delivery log rows inserted |
| `deliveryLogSummary.pending` | Yes (Phase 51) | Rows with email |
| `deliveryLogSummary.skipped` | Yes (Phase 51) | Rows without email |

Counts depend on staging data; shape must match. Compare with **Manual Delivery Test** queue preview summary in the admin UI for the same `asOfDate`.

---

## What to check in Supabase

After manual invoke, confirm **no side effects**:

| # | Check | Expected | Pass |
|---|--------|----------|:----:|
| S.1 | Edge Function logs show **200** for `scheduled-reminder-runner` | No errors, no outbound email provider calls | ☐ |
| S.2 | **`reminder_delivery_logs`** (Phase 51) | **New rows** per candidate, linked to `automationRunId`; `pending` / `skipped` only; no `sent_at` | ☐ |
| S.3 | **`automation_runs`** (Phase 47) | **One new row** with `run_type = scheduled_reminder_dry_run`, matching `automationRunId` in response | ☐ |
| S.4 | **`compliance_records`** / **`history_entries`** | No new rows or reminder-sent changes | ☐ |
| S.5 | **No email** in any inbox | Dry run does not send mail | ☐ |
| S.6 | **Edge Functions → Schedules** | No cron attached to `scheduled-reminder-runner` | ☐ |
| S.7 | Network trace | **No** `api.resend.com`, **no** `send-reminder-deliveries` invoke | ☐ |

---

## Acceptance commands

```powershell
npm run build
npm run verify-scheduled-runner-dry-run
npm run verify-scheduled-runner-deploy-smoke
npm run verify-automation-run-records
```

Then complete **Deployment checklist** and **Manual invocation** above on staging.

---

## Phase 47 — Automation run records

**Goal:** Persist one `automation_runs` audit row per successful dry-run invoke. **No emails, no delivery logs, no mark-as-sent.**

| Item | Detail |
|------|--------|
| Migration | `supabase/migrations/20260401000008_automation_runs_scheduled_dry_run.sql` |
| Insert path | Service role in `scheduled-reminder-runner` |
| Response | Includes `automationRunId` from inserted row |
| Verification | `npm run verify-automation-run-records` |

See [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) for full Phase 47 contract.

**Phase 47 gate:** `npm run verify-automation-run-records` must pass.

---

## Phase 48 — Staging verification for automation_runs persistence

**Goal:** Confirm the **deployed** `scheduled-reminder-runner` on staging creates exactly one `automation_runs` audit row per dry-run invoke and returns the matching `automationRunId`. **Verification only** — no delivery log or mark-as-sent checks.

### Prerequisites

| Requirement | Detail |
|-------------|--------|
| Staging project | `vmrotpztwoeifbdjwdis` |
| Migration | Phase 47 `automation_runs` columns applied (`supabase db push`) |
| Edge Function | `scheduled-reminder-runner` deployed to staging |
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TEST_PASSWORD` |

Default organisation: Alpha Test Organisation `11111111-1111-1111-1111-111111111111` (override with `SUPABASE_TEST_ORGANISATION_ID` or `STAGING_ORGANISATION_ID` in `.env`).

Optional: `SCHEDULED_RUNNER_AS_OF_DATE=YYYY-MM-DD` to pin the scan date.

### Verification script

`scripts/verify-scheduled-runner-automation-run-staging.mjs`

`npm run verify-scheduled-runner-automation-run-staging`:

1. Signs in as staging admin (JWT for Edge Function invoke)
2. POSTs `functions/v1/scheduled-reminder-runner` with `organisationId`
3. Asserts `status: "ok"`, `mode: "dry_run"`, and `automationRunId` present
4. Queries `public.automation_runs` by `automation_run_id` (service role)
5. Asserts exactly one row with `run_type = scheduled_reminder_dry_run`, `mode = dry_run`, `status = completed`
6. Asserts `summary` JSONB and counter columns match the HTTP response summary

**Out of scope for Phase 48:** Resend calls, `reminder_delivery_logs`, `mark_reminder_sent`, compliance/history mutation checks.

### Acceptance command

```powershell
npm run verify-scheduled-runner-automation-run-staging
```

**Phase 48 gate:** `npm run verify-scheduled-runner-automation-run-staging` must pass against staging.

---

## Phase 51 — Dry-run delivery log creation

**Goal:** After each successful `automation_runs` insert, persist one `reminder_delivery_logs` row per dry-run candidate. **Dry-run only** — no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes.

### Flow

1. Compute dry-run candidates (same window rules as Manual Delivery Test)
2. Insert `automation_runs` audit row (Phase 47)
3. Insert `reminder_delivery_logs` rows linked via `automation_run_id` (Phase 51)
4. Return `automationRunId` and `deliveryLogSummary`

**Not transactional:** If step 3 fails, the automation run row from step 2 may already exist. HTTP **500** with `error: "delivery_log_persist_failed"`.

### Delivery log row shape (Phase 51)

| Field | Value |
|-------|-------|
| `organisation_id` | From request |
| `automation_run_id` | From inserted automation run |
| `compliance_record_id`, `person_id`, recipient fields, `compliance_type`, `reminder_type`, `due_date` | From candidate when available |
| `delivery_status` | `pending` when candidate has email; `skipped` when missing email |
| `provider`, `provider_message_id` | `null` |
| `sent_at` | Not set |
| `payload` | `{ mode: "dry_run", reason, asOfDate, …candidate snapshot }` |

### Verification

```powershell
npm run verify-scheduled-runner-delivery-log-dry-run
npm run build
```

**Phase 51 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run` must pass.

---

## Phase 52 — Staging verification for dry-run delivery logs

**Goal:** Confirm the **deployed** `scheduled-reminder-runner` on staging creates `reminder_delivery_logs` rows linked to the returned `automationRunId` after each dry-run invoke. **Verification only** — no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes.

### Prerequisites

| Requirement | Detail |
|-------------|--------|
| Staging project | `vmrotpztwoeifbdjwdis` |
| Migration | Phase 49 `reminder_delivery_logs` schema applied |
| Edge Function | `scheduled-reminder-runner` deployed with Phase 51 delivery log writes |
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TEST_PASSWORD` |

Default organisation: Alpha Test Organisation `11111111-1111-1111-1111-111111111111` (override with `SUPABASE_TEST_ORGANISATION_ID` or `STAGING_ORGANISATION_ID` in `.env`).

Optional: `SCHEDULED_RUNNER_AS_OF_DATE=YYYY-MM-DD` to pin the scan date.

### Verification script

`scripts/verify-scheduled-runner-delivery-log-dry-run-staging.mjs`

`npm run verify-scheduled-runner-delivery-log-dry-run-staging`:

1. Signs in as staging admin (JWT for Edge Function invoke)
2. POSTs `functions/v1/scheduled-reminder-runner` with `organisationId`
3. Asserts `status: "ok"`, `mode: "dry_run"`, `automationRunId`, and `deliveryLogSummary`
4. Queries `public.reminder_delivery_logs` by `automation_run_id` (service role)
5. Asserts row counts match `deliveryLogSummary` (`total`, `pending`, `skipped`; `sent` and `failed` are `0`)
6. Asserts no row has `sent_at` or `provider_message_id`; every row has `provider` null and `payload.mode = "dry_run"`
7. Asserts every row `organisation_id` matches the request
8. Asserts matching `automation_runs` row still exists

**Out of scope for Phase 52:** Resend calls, real email delivery, `mark_reminder_sent`, compliance/history mutation checks.

### Acceptance command

```powershell
npm run verify-scheduled-runner-delivery-log-dry-run-staging
```

**Phase 52 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run-staging` must pass against staging.

---

## Phase 59 — Scheduled runner live-send gate (refused by default)

**Goal:** Prepare `scheduled-reminder-runner` for future live sending with an explicit `mode` and `SCHEDULED_EMAIL_SENDING_ENABLED` config gate. **Gate only** — no scheduled reminder emails, no Resend calls, no `sendReminderEmail`, no `mark_reminder_sent`, no compliance mutation, and no `sent_at` / `provider_message_id` writes from the runner.

### Request modes

| `mode` | Behaviour |
|--------|-----------|
| *(omitted)* | Defaults to `dry_run` — existing Phase 52 behaviour unchanged |
| `dry_run` | Candidate scan + `automation_runs` + dry-run `reminder_delivery_logs` |
| `live_send` | HTTP **409** when sending gate off; allowlisted sends when gates enabled (Phase 61) |

### Refusal response (`live_send`)

```json
{
  "status": "refused",
  "mode": "live_send",
  "reason": "scheduled_live_send_not_enabled"
}
```

| `reason` | When |
|----------|------|
| `scheduled_live_send_not_enabled` | `SCHEDULED_EMAIL_SENDING_ENABLED` is not explicitly `true` / `1` / `yes` (default) |

Refusal is evaluated **before** any settings load, candidate computation, `automation_runs` insert, or `reminder_delivery_logs` insert.

### Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `false` | Edge secret; explicit `true` / `1` / `yes` required to pass gate (live send still refused) |

### Verification

```powershell
npm run verify-scheduled-runner-live-send-gate
npm run verify-scheduled-runner-live-send-gate-staging
npm run build
```

**Phase 59 gate:** `npm run verify-scheduled-runner-live-send-gate` must pass; `npm run verify-scheduled-runner-live-send-gate-staging` must pass against staging (requires Phase 59 deploy).

---

## Phase 60 — Scheduled runner live-send preview mode (no emails)

**Goal:** Add a safe **`live_send_preview`** path that generates email subject/body for each would-send candidate and persists preview metadata in `reminder_delivery_logs` — **preview only, no emails sent**.

### Request modes (updated)

| `mode` | Behaviour |
|--------|-----------|
| *(omitted)* | Defaults to `dry_run` — existing Phase 52 behaviour unchanged |
| `dry_run` | Candidate scan + `automation_runs` + dry-run `reminder_delivery_logs` |
| `live_send` | HTTP **409** when sending gate off; allowlisted sends when gates enabled (Phase 61) |
| `live_send_preview` | Email preview metadata when gate enabled; HTTP **409** when gate disabled |

### Refusal response (`live_send_preview` — gate disabled)

```json
{
  "status": "refused",
  "mode": "live_send_preview",
  "reason": "scheduled_live_send_preview_not_enabled"
}
```

Refusal is evaluated **before** any settings load, candidate computation, or database writes.

### Success response (`live_send_preview` — gate enabled)

```json
{
  "status": "ok",
  "mode": "live_send_preview",
  "organisationId": "uuid",
  "automationRunId": "uuid",
  "summary": {
    "totalCandidates": 5,
    "withEmail": 3,
    "missingEmail": 2,
    "wouldSend": 3,
    "wouldSkip": 2
  },
  "deliveryLogSummary": {
    "total": 5,
    "pending": 3,
    "skipped": 2,
    "failed": 0,
    "sent": 0
  },
  "previewSummary": {
    "totalPreviewed": 5,
    "withEmailPreviewed": 3,
    "skipped": 2
  }
}
```

### Preview delivery log rows

| Candidate | `delivery_status` | `payload` |
|-----------|-------------------|-----------|
| Has email | `pending` | `mode: "live_send_preview"`, `emailPreview.subject`, `emailPreview.bodyText` |
| Missing email | `skipped` | `mode: "live_send_preview"`, `reason: "missing_email"` |

All preview rows: `provider` null, `provider_message_id` null, `sent_at` null.

`automation_runs.run_type` = `scheduled_reminder_live_send_preview`, `mode` = `live_send_preview`, `status` = `completed`.

### Email template

Reuses the Phase 53 reminder email template framework via Edge-safe shared module:

`supabase/functions/_shared/reminder-email-template.ts`

### Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `SCHEDULED_EMAIL_PREVIEW_ENABLED` | `false` | Edge secret; explicit `true` / `1` / `yes` required for `live_send_preview` |

### Safety constraints (Phase 60)

| Guard | Behaviour |
|-------|-----------|
| Resend / SMTP | **Not called** |
| `sendReminderEmail` | **Not called** |
| `mark_reminder_sent` | **Not called** |
| Compliance / history mutation | **None** |
| `sent_at` / `provider_message_id` | **Not written** |
| `dry_run` | **Unchanged** |
| `live_send` | **Allowlisted sends when gates enabled** (Phase 61) |

### Verification

```powershell
npm run verify-scheduled-runner-live-send-preview
npm run verify-scheduled-runner-live-send-preview-staging
npm run build
```

**Phase 60 gate:** `npm run verify-scheduled-runner-live-send-preview` must pass; `npm run verify-scheduled-runner-live-send-preview-staging` must pass against staging (requires Phase 60 deploy).

**Enable preview on staging:**

```powershell
supabase secrets set SCHEDULED_EMAIL_PREVIEW_ENABLED=true --project-ref vmrotpztwoeifbdjwdis
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

---

## Phase 61 — Scheduled runner controlled live send (allowlisted only)

**Goal:** Implement **`live_send`** to send real emails **only to allowlisted recipients**, with delivery log auditing. **No mark-as-sent**, **no compliance mutation**, **no reminder sent history writes**.

### Success response (`live_send` — gates enabled)

```json
{
  "status": "ok",
  "mode": "live_send",
  "organisationId": "uuid",
  "automationRunId": "uuid",
  "summary": { "totalCandidates": 5, "withEmail": 3, "missingEmail": 2, "wouldSend": 3, "wouldSkip": 2 },
  "deliveryLogSummary": { "total": 5, "sent": 1, "skipped": 4, "failed": 0, "pending": 0 },
  "sendSummary": {
    "attempted": 1,
    "sent": 1,
    "failed": 0,
    "skippedMissingEmail": 2,
    "skippedNotAllowlisted": 2
  }
}
```

### Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `false` | Runner gate |
| `EMAIL_SENDING_ENABLED` | `false` | Provider gate |
| `SCHEDULED_EMAIL_ALLOWLIST` | — | Comma-separated; required |

### Verification

```powershell
npm run verify-scheduled-runner-controlled-live-send
npm run verify-scheduled-runner-controlled-live-send-staging
npm run build
```

**Enable live send on staging:**

```powershell
supabase secrets set SCHEDULED_EMAIL_SENDING_ENABLED=true EMAIL_SENDING_ENABLED=true SCHEDULED_EMAIL_ALLOWLIST=you@example.com --project-ref vmrotpztwoeifbdjwdis
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

---

## Verification (automated)

```powershell
npm run verify-scheduled-runner-dry-run
npm run verify-scheduled-runner-deploy-smoke
```

`verify-scheduled-runner-dry-run` checks:

1. Edge Function exists with auth, validation, and dry-run response shape
2. Static safety gates — no Resend, delivery log RPCs, mark-as-sent, or `send-reminder-deliveries`
3. Fixture parity — `computeScheduledRunnerDryRunSummary` matches Manual Delivery Test queue summary
4. Documentation cross-references in architecture docs and ROADMAP

`verify-scheduled-runner-deploy-smoke` checks:

1. Phase 46 deploy command, manual invocation docs, and expected response shape
2. Static safety gates on deployed function source
3. Runs `build` + `verify-scheduled-runner-dry-run` as preflight

---

## Deployment (Phase 45 — superseded by Phase 46)

Phase 45 documented optional deploy without project ref. **Use the exact Phase 46 command** for staging:

```powershell
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

---

**Next slice:** V6 Phase 62 — mark-as-sent after successful scheduled delivery (complete).

---

## Phase 62 — Scheduled runner mark sent after successful delivery

**Goal:** After each successful **`live_send`** provider delivery and persisted **`sent`** delivery log row, call existing **`mark_reminder_sent`** RPC for that compliance record/reminder type. **Successful-delivery-only** — no mark-as-sent for skipped, failed, `dry_run`, or `live_send_preview`.

### Success response (`live_send` — gates enabled, mark-sent succeeded)

```json
{
  "status": "ok",
  "mode": "live_send",
  "organisationId": "uuid",
  "automationRunId": "uuid",
  "summary": { "totalCandidates": 5, "withEmail": 3, "missingEmail": 2, "wouldSend": 3, "wouldSkip": 2 },
  "deliveryLogSummary": { "total": 5, "sent": 1, "skipped": 4, "failed": 0, "pending": 0 },
  "sendSummary": {
    "attempted": 1,
    "sent": 1,
    "failed": 0,
    "skippedMissingEmail": 2,
    "skippedNotAllowlisted": 2
  },
  "markSentSummary": {
    "attempted": 1,
    "markedSent": 1,
    "failed": 0,
    "skipped": 0
  }
}
```

### Partial success (`mark_reminder_sent` failed after send + log)

```json
{
  "status": "completed_with_errors",
  "mode": "live_send",
  "markSentSummary": { "attempted": 1, "markedSent": 0, "failed": 1, "skipped": 0 }
}
```

HTTP **200** — email was sent and delivery log persisted; compliance mutation failed.

### Ordering (live_send only)

1. `sendReminderEmail` succeeds
2. `reminder_delivery_logs` row persisted with `delivery_status=sent`, `provider_message_id`, `sent_at`
3. `mark_reminder_sent(p_record_id, p_reminder_type)` via caller JWT
4. History entry written per existing RPC behaviour

### Verification

```powershell
npm run verify-scheduled-runner-mark-sent-after-delivery
npm run verify-scheduled-runner-mark-sent-after-delivery-staging
npm run build
```

**Deploy Phase 62 to staging:**

```powershell
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

---

## Next slice (out of scope)

- Wire scheduler (cron / external job) to invoke dry run or full delivery path
- Idempotency for scheduled path
- Invoke `send-reminder-deliveries` after operational sign-off

See [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md), [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) § Phase 62, and [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md).
