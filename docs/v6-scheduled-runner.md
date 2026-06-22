# V6 Phase 45 — Scheduled Automation Runner (Dry Run)

**Theme:** Server-side structure for scheduled reminder automation — candidate identification only.  
**Status:** Dry run complete — no automatic sends, no cron, no production mode changes.  
**Date:** June 2026

---

## Executive summary

Phase 45 adds `scheduled-reminder-runner`, a Supabase Edge Function that scans an organisation's compliance data and returns the same reminder **candidates** as the admin **Manual Delivery Test** queue preview. The function is authenticated, read-only, and does **not** invoke `send-reminder-deliveries` or any email provider.

| Today (Phase 45) | Future (out of scope) |
|------------------|----------------------|
| Dry-run candidate scan via Edge Function | Cron / pg_cron schedule |
| Summary counts only | Automatic Resend sends |
| JWT + RLS read paths | Delivery log writes from scheduler |
| Same window rules as Manual Delivery Test | Test-mode mark-as-sent from scheduler |

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

## Safety constraints (Phase 45)

| Guard | Phase 45 behaviour |
|-------|-------------------|
| Resend / SMTP | **Not called** |
| `send-reminder-deliveries` | **Not invoked** |
| `reminder_delivery_logs` | **No writes** |
| `mark_reminder_sent` | **Not called** |
| Compliance / history mutation | **None** |
| `automation_runs` | **No writes** (deferred until a later phase) |
| Production `EMAIL_MODE` | **Unchanged** |
| Cron / scheduler | **Not deployed** — documented only |

---

## Verification

```powershell
npm run verify-scheduled-runner-dry-run
```

Checks:

1. Edge Function exists with auth, validation, and dry-run response shape
2. Static safety gates — no Resend, delivery log RPCs, mark-as-sent, or `send-reminder-deliveries`
3. Fixture parity — `computeScheduledRunnerDryRunSummary` matches Manual Delivery Test queue summary
4. Documentation cross-references in architecture docs and ROADMAP

**Phase 45 gate:** `npm run verify-scheduled-runner-dry-run` must pass.

---

## Deployment (optional — not required for verification)

When ready to smoke-test in Supabase (still dry run only):

```powershell
supabase functions deploy scheduled-reminder-runner
```

Invoke with an admin JWT:

```http
POST /functions/v1/scheduled-reminder-runner
Authorization: Bearer <access_token>
Content-Type: application/json

{"organisationId":"<org-uuid>"}
```

No emails are sent. Response contains summary counts only.

---

## Next slice (out of scope)

- Wire scheduler (cron / external job) to invoke dry run or full delivery path
- Optional `automation_runs` record on scheduled execution
- Invoke `send-reminder-deliveries` after operational sign-off
- Idempotency and mark-as-sent for scheduled path

See [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) § Phase 45 and [`docs/v5-automated-compliance-operations.md`](v5-automated-compliance-operations.md).
