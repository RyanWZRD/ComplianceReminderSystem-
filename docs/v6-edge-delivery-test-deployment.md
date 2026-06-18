# V6 Phase 40 — Edge Function Test-Mode Deployment Readiness

Prepare **safe deployment and testing** of `send-reminder-deliveries` in Supabase **test mode** only. This phase is documentation, checklists, and verification gates — **no new application logic**.

**Baseline:** V6 Phase 39 (browser invoke wiring) on **v6.0.0-beta.1**  
**Scope:** Deployment readiness for staging/local test sends via Edge Function — **not** production sending.

**Related docs:**

- [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) — Edge Function contract and Phase 38–39 behaviour
- [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) — delivery domain model and phase cross-reference
- [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md) — provider env vars and test/production gates
- [`docs/staging-deployment.md`](staging-deployment.md) — static app staging host and Supabase setup

---

## Constraints (Phase 40)

| Rule | Detail |
|------|--------|
| **No production sending** | `EMAIL_MODE` must be `test` in Supabase secrets — never `production` for this phase |
| **No mark-as-sent** | Delivery must not auto-mark reminders sent |
| **No delivery log writes** | Edge Function must not call `create_reminder_delivery_log` yet |
| **No compliance/history mutation** | Register rows and history entries unchanged by delivery |
| **No scheduled execution** | Manual Delivery Test UI only — admin-initiated |
| **Browser invoke only** | Manual delivery path uses `supabase.functions.invoke` — no browser Resend fetch |
| **Secrets server-side only** | `RESEND_API_KEY` in Supabase Edge Function secrets — never in git or browser bundle |

---

## Automated gate

Run from the repository root:

```powershell
npm run verify-edge-delivery-test-deployment
```

This verifies the checklist document is complete, static safety gates pass, and prerequisite Edge Function verify scripts still pass. **No feature code changes required** for this phase unless a bug is found during manual smoke testing.

---

## Required Supabase Edge Function secrets

Set these on the **staging** Supabase project (or local `supabase functions serve` via `.env.local` / linked secrets). **Never commit values to git.**

| Secret | Required | Example / notes |
|--------|:--------:|-----------------|
| `RESEND_API_KEY` | **Yes** | Resend API key with send scope — missing → `503` `{ error: "provider_not_configured" }` |
| `EMAIL_MODE` | **Yes** | Must be **`test`** for Phase 40 — any other value → `503` `{ error: "invalid_email_mode" }` |
| `EMAIL_FROM_ADDRESS` | **Yes** | Verified sender (e.g. `reminders@yourorg.org` or Resend onboarding domain for staging) — missing → `503` `{ error: "invalid_config" }` |
| `EMAIL_REPLY_TO_ADDRESS` | Recommended | Safeguarding inbox for replies — optional but recommended |
| `EMAIL_TEST_REDIRECT_TO` | **Yes** (when `EMAIL_MODE=test`) | Controlled inbox that receives **all** test sends — missing → `503` `{ error: "invalid_config" }` |
| `EMAIL_RATE_LIMIT_PER_RUN` | Optional | Max send attempts per invocation (default `50`) |

### Secret checklist (before deploy)

| # | Check | Pass |
|---|--------|:----:|
| S.1 | `RESEND_API_KEY` set in Supabase **Edge Function secrets** (not in `.env` committed to git, not in `email-provider-env.js`) | ☐ |
| S.2 | `EMAIL_MODE=test` (not `production`) | ☐ |
| S.3 | `EMAIL_FROM_ADDRESS` uses a Resend-verified domain or documented staging sender | ☐ |
| S.4 | `EMAIL_REPLY_TO_ADDRESS` set to a monitored safeguarding inbox | ☐ |
| S.5 | `EMAIL_TEST_REDIRECT_TO` set to a **team-controlled** inbox (not a real staff member's production email) | ☐ |
| S.6 | `EMAIL_RATE_LIMIT_PER_RUN` set appropriately for staging (e.g. `10` for initial smoke tests) | ☐ |
| S.7 | Committed `js/data/email-provider-env.js` keeps `RESEND_API_KEY: undefined` | ☐ |
| S.8 | Browser `.env` synced for **non-secret** UI gates only (`EMAIL_PROVIDER_ENABLED`, `EMAIL_MODE`, redirect display) via `npm run sync-env` | ☐ |

### Set secrets (Supabase CLI)

Replace placeholders with real values. Run from the repository root with the staging project linked:

```powershell
supabase secrets set `
  RESEND_API_KEY=re_xxxxxxxx `
  EMAIL_MODE=test `
  EMAIL_FROM_ADDRESS=reminders@yourorg.org `
  EMAIL_REPLY_TO_ADDRESS=safeguarding@yourorg.org `
  EMAIL_TEST_REDIRECT_TO=delivery-test@yourorg.org `
  EMAIL_RATE_LIMIT_PER_RUN=10
```

Verify secrets are registered (names only — values are not shown):

```powershell
supabase secrets list
```

---

## Deployment checklist

| # | Step | Pass |
|---|------|:----:|
| D.1 | Staging Supabase project linked: `supabase link --project-ref YOUR_STAGING_REF` | ☐ |
| D.2 | Migrations applied through V6 delivery log RPCs (`20260401000006`, `20260401000007`) | ☐ |
| D.3 | Edge Function secrets set per **Secret checklist** above | ☐ |
| D.4 | Deploy Edge Function: `supabase functions deploy send-reminder-deliveries --project-ref YOUR_STAGING_REF` | ☐ |
| D.5 | Confirm function appears in Supabase Dashboard → **Edge Functions** → `send-reminder-deliveries` | ☐ |
| D.6 | `npm run sync-env` — browser non-secret provider settings for Manual Delivery UI gate | ☐ |
| D.7 | `npm run build` — fresh `app.bundle.js` | ☐ |
| D.8 | Static app deployed with `js/data/supabase-env.js` pointing at staging project | ☐ |
| D.9 | Auth URL configuration includes staging origin (see [`staging-deployment.md`](staging-deployment.md)) | ☐ |
| D.10 | Local automated gates pass (see **Acceptance commands** below) | ☐ |

### Deploy command

```powershell
supabase functions deploy send-reminder-deliveries --project-ref YOUR_STAGING_REF
```

For local function development with secrets:

```powershell
supabase functions serve send-reminder-deliveries --env-file supabase/.env.local
```

Create `supabase/.env.local` (gitignored) with the same secret names as production staging — **never commit this file**.

---

## Test-mode behaviour (must confirm)

These behaviours are implemented in `supabase/functions/send-reminder-deliveries/index.ts` and verified statically by `verify-edge-delivery-test-deployment`.

| # | Behaviour | Implementation | Pass |
|---|-----------|----------------|:----:|
| T.1 | All real recipients redirect to `EMAIL_TEST_REDIRECT_TO` when `EMAIL_MODE=test` | `resolveOutboundEmail` uses `config.testRedirectTo` | ☐ |
| T.2 | Subject prefixed with `[TEST]` in test mode | `` `[TEST] ${subject}` `` in `resolveOutboundEmail` | ☐ |
| T.3 | Missing `RESEND_API_KEY` → `503 provider_not_configured` | `loadProviderConfig()` | ☐ |
| T.4 | Invalid/missing `EMAIL_MODE` → `503 invalid_email_mode` | `loadProviderConfig()` | ☐ |
| T.5 | Missing `EMAIL_FROM_ADDRESS` or `EMAIL_TEST_REDIRECT_TO` (test mode) → `503 invalid_config` | `loadProviderConfig()` | ☐ |
| T.6 | Browser invokes Edge Function only — no `api.resend.com` in manual execution path | `edge-delivery-invoke.js` → `functions.invoke` | ☐ |
| T.7 | No `create_reminder_delivery_log`, mark-as-sent, compliance, or history writes in Edge Function or manual execution | Static verify gates | ☐ |

---

## Local smoke test plan

**Goal:** Confirm Edge Function responds correctly before staging UI test. Uses local static server + Supabase staging project (or `supabase functions serve`).

### Prerequisites

```powershell
npm run sync-env
npm run build
npm run verify-edge-delivery-test-deployment
```

### Local static server

```powershell
npm run serve
```

Open: `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1`

Sign in as **alpha-admin@example.com** (or staging admin account).

### Local smoke checks

| # | Check | Expected | Pass |
|---|--------|----------|:----:|
| L.1 | Manual Delivery Test card visible (admin + cloud writes + provider enabled) | Card renders with queue summary | ☐ |
| L.2 | Provider mode display shows **test** (from synced non-secret env) | Read-only test mode indicator | ☐ |
| L.3 | Confirm delivery test → Edge Function invoked (Network tab: `POST .../functions/v1/send-reminder-deliveries`) | **No** request to `api.resend.com` from browser | ☐ |
| L.4 | With secrets **missing** on project: invoke returns error surfaced in UI | `503` / provider not configured message | ☐ |
| L.5 | With secrets **set** and `EMAIL_MODE=test`: delivery summary shows attempted/delivered counts | UI `executionSummary` populated | ☐ |
| L.6 | Email arrives at `EMAIL_TEST_REDIRECT_TO` only — **not** at queue item recipient addresses | Inbox check | ☐ |
| L.7 | Received email subject starts with `[TEST]` | Inbox check | ☐ |
| L.8 | Delivery Operations Log **unchanged** (no new rows from this send) | Log count stable | ☐ |
| L.9 | Compliance register and history **unchanged** | Spot-check register | ☐ |
| L.10 | Reminders **not** marked sent | Queue/register status unchanged | ☐ |

### Missing-secrets failure test

Temporarily remove or unset `RESEND_API_KEY` on a **non-production** project (or use a fresh project without secrets):

1. Run Manual Delivery Test from UI
2. Confirm UI shows an error (Edge Function `503` / `provider_not_configured`)
3. Confirm **no** email sent
4. Restore secrets before continuing

---

## Staging smoke test plan

**Goal:** End-to-end validation on the deployed staging hostname with real Edge Function + Resend test sends.

### Prerequisites

Complete **Deployment checklist** and **Secret checklist** above.

```powershell
npm run sync-env
npm run verify-staging-config
npm run build
```

Deploy static files to staging host. Open:

`https://YOUR_STAGING_ORIGIN/?backend=cloud&cloudWrites=1`

### Staging smoke checks

| # | Check | Expected | Pass |
|---|--------|----------|:----:|
| ST.1 | Sign in as **admin** on staging hostname | Manual Delivery Test card visible | ☐ |
| ST.2 | Sign in as **editor** / **viewer** | Manual Delivery Test **hidden** or disabled | ☐ |
| ST.3 | Run Manual Delivery Test with 1+ queue items that have recipient emails | Edge Function returns `200` with summary | ☐ |
| ST.4 | All emails land in `EMAIL_TEST_REDIRECT_TO` inbox | No email to real staff addresses | ☐ |
| ST.5 | Subject line includes `[TEST]` prefix | Visual inbox check | ☐ |
| ST.6 | From address matches `EMAIL_FROM_ADDRESS` secret | Email headers check | ☐ |
| ST.7 | Reply-To matches `EMAIL_REPLY_TO_ADDRESS` when set | Email headers check | ☐ |
| ST.8 | Supabase Dashboard → Edge Functions → `send-reminder-deliveries` → Logs show invocation | No secret values in logs | ☐ |
| ST.9 | `reminder_delivery_logs` table row count **unchanged** after test send | SQL or Delivery Operations Log UI | ☐ |
| ST.10 | No compliance/history/register mutation | Spot-check before/after | ☐ |

---

## What to check in Supabase

### Dashboard — Edge Functions

| Location | Check |
|----------|--------|
| **Edge Functions → send-reminder-deliveries** | Function deployed; recent invocations after Manual Delivery Test |
| **Edge Functions → Secrets** | All six secret **names** present (`RESEND_API_KEY`, `EMAIL_MODE`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO_ADDRESS`, `EMAIL_TEST_REDIRECT_TO`, `EMAIL_RATE_LIMIT_PER_RUN`) |
| **Edge Functions → Logs** | `POST` invocations return `200` (success) or `503` (misconfigured secrets) — never `500` from unhandled errors |
| **Logs → Edge Function** | No `RESEND_API_KEY` value printed in log output |

### Dashboard — Database

| Location | Check |
|----------|--------|
| **Table Editor → reminder_delivery_logs** | Row count **unchanged** after Phase 40 test sends |
| **Table Editor → compliance_records** | No unexpected updates from delivery test |
| **Table Editor → history** | No new entries from delivery test |

### CLI verification

```powershell
supabase secrets list
supabase functions list
```

---

## Acceptance commands

Run these from the repository root **before** manual smoke testing and **after** any doc or verify script changes:

```powershell
npm run verify-edge-delivery-test-deployment
```

This orchestrates:

1. Documentation completeness checks (`docs/v6-edge-delivery-test-deployment.md`)
2. Static safety gates (test redirect, `[TEST]` prefix, missing-secret failures, browser invoke only, no persistence/mutation hooks)
3. Prerequisite scripts:
   - `verify-edge-delivery-function-skeleton`
   - `verify-edge-delivery-resend`
   - `verify-edge-delivery-browser-invoke`

### Full pre-deploy stack (recommended)

```powershell
npm run build
npm run verify-edge-delivery-test-deployment
npm run verify-manual-delivery-e2e-foundation
npm run sync-env
npm run verify-staging-config
```

### Deploy and smoke (manual)

```powershell
supabase secrets set RESEND_API_KEY=... EMAIL_MODE=test EMAIL_FROM_ADDRESS=... EMAIL_REPLY_TO_ADDRESS=... EMAIL_TEST_REDIRECT_TO=... EMAIL_RATE_LIMIT_PER_RUN=10
supabase functions deploy send-reminder-deliveries --project-ref YOUR_STAGING_REF
npm run serve
```

Then execute **Local smoke test plan** or **Staging smoke test plan** checklists above.

---

## Phase 40 non-goals

- `EMAIL_MODE=production` deployment or real-recipient sends
- Delivery log persistence from Edge Function outcomes (Phase 41+)
- Mark-as-sent automation
- Scheduled or automatic delivery execution
- JWT admin-role validation inside Edge Function (deferred — browser gates admin today)
- Staging CORS hostname expansion (`EDGE_DELIVERY_ALLOWED_ORIGINS`) — local origins only until staging secret added

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Engineering | | | Automated gates pass; Edge Function deployed with test secrets |
| Safeguarding / ops | | | Test email received at redirect inbox with `[TEST]` prefix only |
| Admin QA | | | No delivery logs, mark-sent, or register mutation observed |

**Next slice after Phase 40:** Delivery log persistence from Edge Function outcomes (planned).
