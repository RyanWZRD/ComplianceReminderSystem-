# V6 Scheduled Automation Runner

**Theme:** Server-side structure for scheduled reminder automation — candidate identification only.  
**Phases:** 45 (dry run implementation) · 46 (staging deploy + smoke test)  
**Date:** June 2026

---

## Executive summary

Phase 45 adds `scheduled-reminder-runner`, a Supabase Edge Function that scans an organisation's compliance data and returns the same reminder **candidates** as the admin **Manual Delivery Test** queue preview. Phase 46 deploys that function to **staging** and documents a **manual dry-run smoke test** — still no automatic sends, no cron, and no production mode changes.

| Today (Phase 45–46) | Future (out of scope) |
|---------------------|----------------------|
| Dry-run candidate scan via Edge Function | Cron / pg_cron schedule |
| Staging deploy + manual smoke test | Automatic Resend sends |
| Summary counts only | Delivery log writes from scheduler |
| JWT + RLS read paths | Test-mode mark-as-sent from scheduler |
| Same window rules as Manual Delivery Test | Invoke `send-reminder-deliveries` from scheduler |

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
  "asOfDate": "2026-06-22"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `organisationId` | Yes | Organisation to scan |
| `asOfDate` | No | ISO date (`YYYY-MM-DD`); defaults to today at local midnight |

### Response body (dry run)

```json
{
  "status": "ok",
  "mode": "dry_run",
  "asOfDate": "2026-06-22",
  "organisationId": "uuid",
  "summary": {
    "totalCandidates": 5,
    "withEmail": 3,
    "missingEmail": 2,
    "wouldSend": 3,
    "wouldSkip": 2
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

---

## Safety constraints (Phase 45–46)

| Guard | Behaviour |
|-------|-----------|
| Resend / SMTP | **Not called** |
| `send-reminder-deliveries` | **Not invoked** |
| `reminder_delivery_logs` | **No writes** |
| `mark_reminder_sent` | **Not called** |
| Compliance / history mutation | **None** |
| `automation_runs` | **No writes** (deferred until a later phase) |
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
| **No delivery log writes** | `reminder_delivery_logs` unchanged |
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
| D.7 | `reminder_delivery_logs` row count unchanged | ☐ |
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
  "summary": {
    "totalCandidates": 5,
    "withEmail": 3,
    "missingEmail": 2,
    "wouldSend": 3,
    "wouldSkip": 2
  }
}
```

| Field | Required | Meaning |
|-------|:--------:|---------|
| `status` | Yes | Must be `"ok"` on success |
| `mode` | Yes | Must be `"dry_run"` |
| `summary.totalCandidates` | Yes | Records in an active reminder window |
| `summary.withEmail` | Yes | Candidates with recipient email |
| `summary.missingEmail` | Yes | Candidates without email |
| `summary.wouldSend` | Yes | Same as `withEmail` |
| `summary.wouldSkip` | Yes | Same as `missingEmail` |

Counts depend on staging data; shape must match. Compare with **Manual Delivery Test** queue preview summary in the admin UI for the same `asOfDate`.

---

## What to check in Supabase

After manual invoke, confirm **no side effects**:

| # | Check | Expected | Pass |
|---|--------|----------|:----:|
| S.1 | Edge Function logs show **200** for `scheduled-reminder-runner` | No errors, no outbound email provider calls | ☐ |
| S.2 | **`reminder_delivery_logs`** row count | Unchanged before vs after invoke | ☐ |
| S.3 | **`compliance_records`** / **`history_entries`** | No new rows or reminder-sent changes | ☐ |
| S.4 | **No email** in any inbox | Dry run does not send mail | ☐ |
| S.5 | **Edge Functions → Schedules** | No cron attached to `scheduled-reminder-runner` | ☐ |
| S.6 | Network trace | **No** `api.resend.com`, **no** `send-reminder-deliveries` invoke | ☐ |

---

## Acceptance commands

```powershell
npm run build
npm run verify-scheduled-runner-dry-run
npm run verify-scheduled-runner-deploy-smoke
```

Then complete **Deployment checklist** and **Manual invocation** above on staging.

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

## Next slice (out of scope)

- Wire scheduler (cron / external job) to invoke dry run or full delivery path
- Optional `automation_runs` record on scheduled execution
- Invoke `send-reminder-deliveries` after operational sign-off
- Idempotency and mark-as-sent for scheduled path

See [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) § Phase 45 and [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md).
