# v6.0.0 — Edge Function: `send-reminder-deliveries`

**Theme:** Server-side reminder email delivery via Supabase Edge Function. V6 Phase 36 defined the architecture; **V6 Phase 37** added the skeleton; **V6 Phase 38** implements Resend sending server-side.

**Target:** v6.0.0 (major release)  
**Phase:** V6 Phase 38 — Edge Function Resend integration  
**Prerequisites:** V6 Phase 37 (Edge Function skeleton)  
**Date:** Planned — June 2026+

---

## Executive summary

V6 now has **two Resend code paths** during the Phase 38 → Phase 39 transition:

| Path | Module | Status (Phase 38) | `RESEND_API_KEY` location |
|------|--------|-------------------|---------------------------|
| **Server (authoritative)** | `supabase/functions/send-reminder-deliveries/index.ts` | Implemented — Resend via `Deno.env.get` | Supabase Edge Function secrets only |
| **Browser (legacy scaffold)** | `manual-delivery-execution.js` → `resend-provider.js` | Wired to Manual Delivery UI but **inert in committed defaults** | `email-provider-env.js` (must stay `undefined` in git) |

**Committed git state:** `email-provider-env.js` sets all provider fields to `undefined`, so `getEmailProviderConfig()` returns `enabled: false`. The Manual Delivery UI shows *Email provider is not enabled* and does not call Resend.

**After `npm run sync-env` with local `.env`:** the legacy browser path can become **active** if `EMAIL_PROVIDER_ENABLED=true`, provider settings, and `RESEND_API_KEY` are synced — this is for pre-Phase-39 manual staging only. Browser `fetch` to Resend remains CORS-blocked and exposes any synced key in the bundle.

**Phase 39 requirement:** Manual Delivery UI must invoke `send-reminder-deliveries` instead of `createResendEmailProvider`. The browser must **not** be the production sending path after Phase 39.

Original motivation for server-side delivery:

1. **CORS** — Resend's API does not allow browser-origin `fetch` calls; preflight is rejected.
2. **Secret exposure** — Any API key shipped to `email-provider-env.js` (or bundled in `app.bundle.js`) is visible to every authenticated user who opens DevTools.

**V6 Phase 36** defines the replacement: the browser calls a **Supabase Edge Function**; the Edge Function holds `RESEND_API_KEY` in Supabase secrets and calls Resend server-side. Delivery outcomes are persisted via the existing `create_reminder_delivery_log` RPC / `reminder_delivery_logs` table.

| Today (blocked) | Planned (Phase 36+) |
|-----------------|---------------------|
| Browser → Resend API | Browser → Edge Function → Resend API |
| `RESEND_API_KEY` in `email-provider-env.js` | `RESEND_API_KEY` in Supabase Edge Function secrets only |
| CORS failure on real send | Same-origin Edge Function invoke (no Resend CORS) |
| Client-side `createResendEmailProvider` | Server-side Resend adapter inside Edge Function |

**Non-goals for Phase 36:** No deployed function, browser wiring changes, removing the in-browser Resend provider module, mark-as-sent automation, or new schema/RPC migrations.

---

## Function identity

| Property | Value |
|----------|-------|
| **Name** | `send-reminder-deliveries` |
| **Runtime** | Supabase Edge Function (Deno) |
| **Invoke path** | `POST /functions/v1/send-reminder-deliveries` |
| **Auth** | Supabase JWT (`Authorization: Bearer <access_token>`) |

---

## Request payload

The browser sends a JSON body after the admin confirms **Manual Delivery Test** (or future scheduled worker invokes the same contract with a service role — out of Phase 36 scope).

```typescript
interface SendReminderDeliveriesRequest {
  /** Owning organisation — must match caller's current org membership */
  organisationId: string;

  /** Automation run that produced this delivery batch */
  automationRunId: string;

  /**
   * Provider mode for this invocation.
   * - "test" — redirect recipients per EMAIL_TEST_REDIRECT_TO; prefix subject with [TEST]
   * - "production" — send to real recipients (additional gates in implementation phase)
   */
  mode: "test" | "production";

  /**
   * Prepared delivery records ready for provider handoff.
   * Browser builds these via buildReminderDeliveryRecords + state machine;
   * Edge Function validates and sends only records in "prepared" status.
   */
  deliveryRecords: Array<{
    queueItemId: string;
    recipientEmail: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    complianceRecordId?: string | null;
    personId?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}
```

### Validation rules (planned)

| Rule | Behaviour |
|------|-----------|
| `organisationId` | Required UUID; must equal caller's active organisation |
| `automationRunId` | Required UUID; must belong to `organisationId` |
| `mode` | Required; `production` requires explicit server-side gate (env flag + allowlist) |
| `deliveries` / `deliveryRecords` | Non-empty array in full implementation; skeleton accepts any array |
| Per delivery | `queueItemId`, `subject`, `bodyText` required; `recipientEmail` required unless already `failed` at preparation |
| Skip | Records that would be `failed` with `missing_recipient_email` are rejected at validation with per-item error — not sent |

---

## Admin-only authorization

Delivery is a safeguarding-sensitive write. The Edge Function must enforce **admin role** before any Resend call or delivery log insert.

### Planned auth flow

```
1. Parse Authorization header → Supabase JWT
2. supabase.auth.getUser(jwt) → user id
3. Resolve organisation membership + role for organisationId
   (reuse existing org-role pattern from RPCs — admin only)
4. If role !== "admin" → 403 { error: "admin_required" }
5. If organisationId mismatch → 403 { error: "organisation_mismatch" }
```

| Check | Failure response |
|-------|------------------|
| Missing / invalid JWT | `401` |
| User not member of org | `403` |
| Role is `editor` or `viewer` | `403` |
| Cloud writes disabled for org | `403` |

The browser **Manual Delivery UI** already gates on `canRunManualDeliveryTest()` (admin + cloud mode + `CLOUD_WRITES_ENABLED`). The Edge Function repeats these checks server-side — **never trust the client**.

---

## Provider mode: test vs production

Mode is passed in the request body and cross-checked against Edge Function secrets.

| Mode | Resend behaviour | Gates |
|------|------------------|-------|
| `test` | Redirect all recipients to `EMAIL_TEST_REDIRECT_TO`; prefix subject with `[TEST]` | Default for staging; no extra gate |
| `production` | Send to real `recipientEmail` | Requires `EMAIL_MODE=production` secret **and** optional org allowlist env |

### Secret mapping (Edge Function only)

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API bearer token |
| `EMAIL_FROM_ADDRESS` | Verified sender domain |
| `EMAIL_REPLY_TO_ADDRESS` | Reply-To header |
| `EMAIL_TEST_REDIRECT_TO` | Test-mode recipient override |
| `EMAIL_MODE` | `test` or `production` — server-side source of truth |
| `EMAIL_RATE_LIMIT_PER_RUN` | Max deliveries per invocation (default `50`) |

**Browser must never receive `RESEND_API_KEY`.** `email-provider-env.js` may expose non-secret settings (`EMAIL_MODE`, `EMAIL_FROM_ADDRESS`, redirect address) for UI display only.

---

## Resend secret handling

| Rule | Detail |
|------|--------|
| Storage | `RESEND_API_KEY` set via `supabase secrets set RESEND_API_KEY=...` — never in repo, `.env` committed to git, or client bundle |
| Access | Read only inside `send-reminder-deliveries` handler at runtime |
| Logging | Never log full API key; redact from error payloads returned to browser |
| Rotation | Update secret in Supabase dashboard; redeploy not required for secret-only rotation |
| Local dev | Use `supabase functions serve` with `.env.local` (gitignored) — same as other Edge Function secrets |

The existing `createResendEmailProvider` module remains for **unit tests with mocked `fetchImpl`** only. Production send path moves to the Edge Function in a future implementation phase.

---

## Delivery log persistence

Every send attempt is audited via the existing Postgres contract — no new table in Phase 36.

### Flow per delivery record

```
1. Edge Function transitions logical record → "sending" (in-memory)
2. Call Resend POST /emails
3. On success → call create_reminder_delivery_log RPC with delivery_status "delivered"
4. On failure → call create_reminder_delivery_log RPC with delivery_status "failed"
```

### RPC: `create_reminder_delivery_log`

Uses the existing migration `20260401000007_reminder_delivery_log_rpcs.sql`:

| Parameter | Source |
|-----------|--------|
| `p_organisation_id` | Request `organisationId` |
| `p_automation_run_id` | Request `automationRunId` |
| `p_queue_item_id` | Delivery `queueItemId` |
| `p_recipient_email` | Actual recipient used (after test redirect) |
| `p_subject` | Subject sent (including `[TEST]` prefix when applicable) |
| `p_body_text` | Plain-text body |
| `p_delivery_status` | `delivered` or `failed` |
| `p_sent_at` / `p_delivered_at` / `p_failed_at` | ISO timestamps from Edge Function clock |
| `p_failure_reason` | Resend error message when failed |
| `p_metadata` | `provider: "resend"`, `providerMessageId`, `failureType`, `reminderWindow`, etc. |

The Edge Function invokes RPC with the **caller's JWT** (user context) so `created_by = auth.uid()` and RLS/admin checks apply. Alternative: service-role RPC wrapper in a later phase if invoke latency requires it — documented here as a future option, not Phase 36.

### Response shape (planned)

```typescript
interface SendReminderDeliveriesResponse {
  status: "ok" | "partial" | "error";
  summary: {
    total: number;
    attempted: number;
    delivered: number;
    failed: number;
    skipped: number;
    persisted: number;
  };
  results: Array<{
    queueItemId: string;
    deliveryStatus: "delivered" | "failed" | "skipped";
    providerMessageId?: string;
    failureReason?: string;
    logId?: string;
  }>;
  error?: string;
}
```

---

## Error handling

| Scenario | HTTP | Response |
|----------|------|----------|
| Invalid JSON body | `400` | `{ error: "invalid_request" }` |
| Validation failure (empty deliveries, bad UUID) | `400` | `{ error: "validation_failed", details: [...] }` |
| Unauthorized | `401` | `{ error: "unauthorized" }` |
| Non-admin | `403` | `{ error: "admin_required" }` |
| Rate limit exceeded (per-run cap) | `429` | `{ error: "rate_limit_exceeded" }` |
| Resend transient (429/5xx) | `200` | Per-item `failed` with `failureType: "transient"` in metadata |
| Resend permanent (4xx except 429) | `200` | Per-item `failed` with `failureType: "permanent"` |
| Missing `RESEND_API_KEY` secret | `503` | `{ error: "provider_not_configured" }` |
| RPC persistence failure after successful send | `200` | `partial` — item `delivered` but `persisted: false` flagged for ops review |

**Principle:** No silent failures. Every attempted send produces a delivery log row or an explicit error in the response.

---

## Rollback plan

If the Edge Function path causes production issues after implementation:

| Step | Action |
|------|--------|
| 1 | **Disable sends** — set `EMAIL_PROVIDER_ENABLED=false` in Edge Function secrets or remove `RESEND_API_KEY` secret |
| 2 | **Revert browser wiring** — restore previous commit of `manual-delivery-execution.js` to in-browser mock/disabled provider (no Resend `fetch`) |
| 3 | **UI fallback** — Manual Delivery Test shows "delivery disabled" from `getEmailProviderConfig` when provider disabled |
| 4 | **Audit** — existing `reminder_delivery_logs` rows are immutable; no data rollback required |
| 5 | **Communicate** — ops uses Delivery Operations Log CSV export to reconcile any partial persistence failures |

Phase 36 adds **documentation and verification only** — rollback is a forward-looking runbook for the implementation phase.

---

## Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser — Manual Delivery UI (admin only)                         │
│  buildReminderDeliveryRecords → confirm → invoke Edge Function   │
│  NO api.resend.com fetch · NO RESEND_API_KEY                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /functions/v1/send-reminder-deliveries
                             │ Authorization: Bearer <supabase_jwt>
┌────────────────────────────▼────────────────────────────────────┐
│  Supabase Edge Function: send-reminder-deliveries                │
│  · Verify JWT + admin role + org scope                           │
│  · Read RESEND_API_KEY from Deno.env (secrets)                   │
│  · Apply test/production mode gates                              │
│  · POST https://api.resend.com/emails (server-side — no CORS)    │
└────────────────────────────┬────────────────────────────────────┘
                             │ create_reminder_delivery_log RPC
┌────────────────────────────▼────────────────────────────────────┐
│  Postgres — reminder_delivery_logs                                 │
│  Immutable audit trail per delivery attempt                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Verification

| Command | Scope |
|---------|-------|
| `npm run verify-edge-delivery-plan` | Phase 36 — architecture docs, CORS/secret safety |
| `npm run verify-edge-delivery-function-skeleton` | Phase 37 — skeleton handler, validation, CORS |
| `npm run verify-edge-delivery-resend` | Phase 38 — server-side Resend integration, safety gates, no browser wiring |
| `npm run verify-manual-delivery-e2e-foundation` | Existing E2E safety gate — must still pass |

**Phase 36 gate:** `npm run verify-edge-delivery-plan` must pass.

**Phase 37 gate:** `npm run verify-edge-delivery-function-skeleton` must pass.

**Phase 38 gate:** `npm run verify-edge-delivery-resend` must pass. Resend integration only — no delivery log writes or browser invoke wiring.

---

## Phase 37 — Edge Function skeleton

**Module:** `supabase/functions/send-reminder-deliveries/index.ts`

**Status:** Structural handler complete — extended by Phase 38 Resend integration.

### Implemented in Phase 37

| Behaviour | Detail |
|-----------|--------|
| `OPTIONS` | `200` + CORS headers for `http://127.0.0.1:8877` and `http://localhost:8877` |
| `POST` only | Other methods → `405` |
| Authorization | Requires `Authorization` header (presence only — JWT validation in later phase) |
| Body validation | `organisationId`, `automationRunId`, `deliveryRecords` (array) required |

### CORS placeholder

No shared Edge Function CORS helper exists in this repo yet. The skeleton hard-codes local dev origins matching `supabase/config.toml` `site_url` (`http://127.0.0.1:8877`). Staging hostnames from `.env` → `STAGING_APP_HOSTNAMES` will be loaded via `EDGE_DELIVERY_ALLOWED_ORIGINS` secret in a later phase.

**Verification:** `npm run verify-edge-delivery-function-skeleton`

---

## Phase 38 — Edge Function Resend integration

**Module:** `supabase/functions/send-reminder-deliveries/index.ts`

**Status:** Server-side Resend sends implemented — not wired to Manual Delivery UI.

### Environment variables (Edge Function secrets)

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API bearer token — **required**; missing → `503 provider_not_configured` |
| `EMAIL_MODE` | `test` or `production` only — otherwise `503 invalid_email_mode` |
| `EMAIL_FROM_ADDRESS` | Verified sender — required |
| `EMAIL_REPLY_TO_ADDRESS` | Optional Reply-To header |
| `EMAIL_TEST_REDIRECT_TO` | Required when `EMAIL_MODE=test` |
| `EMAIL_RATE_LIMIT_PER_RUN` | Max send attempts per invocation (default `50`) |

### Send behaviour

| Mode | Recipient | Subject |
|------|-----------|---------|
| `test` | `EMAIL_TEST_REDIRECT_TO` | `[TEST] {original subject}` |
| `production` | Record `recipientEmail` | Original subject |

### Per-record outcomes

| Outcome | Condition |
|---------|-----------|
| `skipped` | Missing `queueItemId`, `recipientEmail`, `subject`, or `bodyText`; or rate limit exceeded |
| `delivered` | Resend `2xx` response |
| `failed` | Resend `429`/`5xx` (transient) or `4xx` (permanent); network error |

### Response

`200` with `status` (`ok` / `partial` / `error`), `summary` (`total`, `attempted`, `delivered`, `failed`, `skipped`), and `results[]` per `queueItemId`.

### Phase 38 non-goals

- `create_reminder_delivery_log` RPC writes
- Mark-as-sent, compliance, or history mutation
- Browser `supabase.functions.invoke` wiring (Phase 39)
- Behavioral changes to `app.js` / `manual-delivery-execution.js` (legacy browser scaffold retained)

### Dual-path transition safety (Phase 38)

See **Executive summary** above. `npm run verify-edge-delivery-resend` enforces:

| Rule | Verification |
|------|--------------|
| **Forbidden** | Committed real `RESEND_API_KEY` or `re_…` token in `email-provider-env.js` |
| **Forbidden** | `functions.invoke` / `send-reminder-deliveries` in `app.js` or `manual-delivery-execution.js` before Phase 39 |
| **Allowed (temporary)** | Legacy `createResendEmailProvider` scaffold when committed env keeps provider disabled |
| **Required** | Edge Function reads `Deno.env.get("RESEND_API_KEY")` server-side |
| **Required (Phase 39+)** | Browser must not be the production sending path — documented in architecture docs |

**Verification:** `npm run verify-edge-delivery-resend`

**Next slice after Phase 38:** V6 Phase 39 — Browser invoke wiring (planned).

---

## Related documents

| Document | Purpose |
|----------|---------|
| [`v6-delivery-architecture.md`](v6-delivery-architecture.md) | Phase 36 server-side architecture cross-reference |
| [`v6-email-provider-configuration.md`](v6-email-provider-configuration.md) | Provider env vars, test/production gates, Resend adapter contract |
| [`v6-beta-validation.md`](v6-beta-validation.md) | Staging validation before implementation |

**Next slice after Phase 38:** V6 Phase 39 — Browser invoke wiring (planned).
