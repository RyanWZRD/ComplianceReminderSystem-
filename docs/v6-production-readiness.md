# V6 Production Readiness

**Theme:** Comprehensive production-readiness gate for the automated email reminder system — **verification and documentation only**.  
**Phase:** V6 Phase 66  
**Date:** June 2026

---

## Current system status

V6 Phases 45–65 delivered the full scheduled reminder automation stack:

| Area | Status |
|------|--------|
| `scheduled-reminder-runner` Edge Function | Deployed pattern: `dry_run` (default), `live_send_preview`, `live_send` |
| Safety gates | `SCHEDULED_EMAIL_SENDING_ENABLED`, `EMAIL_SENDING_ENABLED`, `SCHEDULED_EMAIL_ALLOWLIST` |
| Delivery audit | `automation_runs` + `reminder_delivery_logs` per run |
| Mark sent | `mark_reminder_sent` only after successful `live_send` + `sent` delivery log |
| Duplicate prevention | `sent`-only idempotency check; `failed`/`skipped` do not block retry |
| Failure handling | `failed` rows with error codes; no mark-sent; `completed_with_errors` |
| Admin visibility | Email Automation UI — **read-only** SELECT for runs and delivery logs |
| Automatic retries | **Not implemented** — manual re-run only |

**Phase 66 scope:** Confirm all critical safety, security, and operational controls are in place before wider use. **No new product functionality** — no new sending, retry, mutation, UI write controls, or Resend behaviour changes.

**Gate command:**

```powershell
npm run verify-v6-production-readiness
npm run build
```

---

## Required environment variables and secrets

Configure these as **Supabase Edge Function secrets** on `scheduled-reminder-runner` (and related functions). **Never commit values to git.**

| Secret | Default | Purpose |
|--------|---------|---------|
| `EMAIL_SENDING_ENABLED` | `false` | Master provider gate — explicit `true` required for any Resend send |
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `false` | Runner gate — explicit `true` required for `live_send` mode |
| `SCHEDULED_EMAIL_ALLOWLIST` | — | Comma-separated recipient emails; **required** for `live_send` |
| `EMAIL_FROM_ADDRESS` | — | Verified sender address (must match Resend domain verification) |
| `RESEND_API_KEY` | — | Resend API key — **server-side only** |
| `SCHEDULED_EMAIL_PREVIEW_ENABLED` | `false` | Explicit `true` required for `live_send_preview` mode |

### Secret handling rules

- **`RESEND_API_KEY` must not be committed or pasted** into chat, docs, `.env` commits, or the browser bundle. Store only in Supabase Edge secrets (`supabase secrets set`).
- `js/data/email-provider-env.js` keeps `RESEND_API_KEY: undefined` in git defaults — the browser must never hold the key.
- **`EMAIL_FROM_ADDRESS` must be verified with Resend** and your sending domain before production `live_send`.
- Local `.env` is for staging verification scripts (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_TEST_PASSWORD`, `SCHEDULED_TEST_EMAIL_TO`) — not for committing `RESEND_API_KEY`.

---

## Safety gates

### Scheduled runner

1. **`dry_run` is the default** when `mode` is omitted from the request body.
2. **`live_send` requires explicit `mode: "live_send"`** in the request — never implied.
3. **`live_send` requires `SCHEDULED_EMAIL_SENDING_ENABLED=true`** — otherwise `scheduled_live_send_not_enabled`.
4. **`live_send` requires `EMAIL_SENDING_ENABLED=true`** — provider refuses when disabled.
5. **`live_send` requires `SCHEDULED_EMAIL_ALLOWLIST`** — non-empty; recipients not on the list are skipped (`not_allowlisted`).
6. **`sendReminderEmail` is never called** from `dry_run` or `live_send_preview`.
7. **`mark_reminder_sent` runs only after** successful provider send **and** persisted `sent` delivery log row.
8. **Duplicate prevention** queries existing `delivery_status: sent` rows only — `failed` and `skipped` do not block retry.
9. **Sequential processing** — one candidate at a time in `live_send`; no `Promise.all` bulk send.

### Delivery logs

| Status | `provider_message_id` | `sent_at` | `error_code` / `error_message` |
|--------|----------------------|-----------|--------------------------------|
| `sent` | Set | Set | null |
| `failed` | null | null | Set (secrets redacted via `normalizeProviderError`) |
| `skipped` | null | null | null (reason in payload) |

Payloads do not include API keys or secrets. Provider errors are sanitized before persistence (`SECRET_REDACTION_PATTERNS` in `_shared/email-provider.ts`).

### UI

- **Email Automation** section is read-only — SELECT only cloud helpers.
- **No** retry, send, delete, or mark-sent buttons.
- Provider message IDs are **shortened** for display (`shortenDisplayId`).
- Raw payload uses **`sanitizePayloadForDisplay`** — safe keys only; no secrets or full email body by default.

---

## Expected modes

| Mode | Sends email? | Gates | Delivery log statuses |
|------|--------------|-------|---------------------|
| `dry_run` | No | None (default) | `pending`, `skipped` |
| `live_send_preview` | No | `SCHEDULED_EMAIL_PREVIEW_ENABLED` | `pending`, `skipped` (+ `emailPreview` metadata) |
| `live_send` | Yes (allowlisted only) | `SCHEDULED_EMAIL_SENDING_ENABLED` + `EMAIL_SENDING_ENABLED` + `SCHEDULED_EMAIL_ALLOWLIST` | `sent`, `skipped`, `failed` |

---

## Pre-production checklist

Before enabling `live_send` beyond staging allowlist testing:

- [ ] `npm run verify-v6-production-readiness` passes
- [ ] `npm run build` passes
- [ ] Edge Function deployed with Phase 64+ `scheduled-reminder-runner`
- [ ] `EMAIL_FROM_ADDRESS` verified in Resend for production domain
- [ ] `SCHEDULED_EMAIL_ALLOWLIST` configured with intended recipients only
- [ ] `SCHEDULED_EMAIL_SENDING_ENABLED` left `false` until deliberate go-live
- [ ] `EMAIL_SENDING_ENABLED` left `false` until deliberate go-live
- [ ] Staging acceptance commands pass (see below)
- [ ] Team understands Email Automation UI is **read-only** — no retry UI yet

---

## Staging verification commands

Run against Alpha staging after deploy. Requires local `.env` with staging credentials.

```powershell
npm run verify-scheduled-runner-controlled-live-send-staging
npm run verify-scheduled-runner-mark-sent-after-delivery-staging
npm run verify-scheduled-runner-duplicate-prevention-staging
npm run verify-scheduled-runner-failure-handling-staging
npm run verify-automation-visibility-cloud-load
```

Static gates (no staging network):

```powershell
npm run verify-scheduled-runner-controlled-live-send
npm run verify-scheduled-runner-mark-sent-after-delivery
npm run verify-scheduled-runner-duplicate-prevention
npm run verify-scheduled-runner-failure-handling
npm run verify-automation-visibility-ui
npm run verify-v6-production-readiness
```

---

## Rollback tags

| Tag / baseline | Use |
|----------------|-----|
| **v6.0.0-beta.1** | Last tagged release candidate before V6 automated email phases 45–66 stack |
| **Disable sends (immediate)** | Set `SCHEDULED_EMAIL_SENDING_ENABLED=false` and `EMAIL_SENDING_ENABLED=false` on Edge secrets — stops all `live_send` without redeploy |
| **Redeploy prior runner** | Redeploy previous `scheduled-reminder-runner` revision from Supabase dashboard if code rollback needed |
| **Data** | Existing `reminder_delivery_logs` and `automation_runs` rows are immutable audit — no data rollback required for send disable |

Phase 66 adds **verification only** — rollback is operational (secret disable + optional function redeploy), not a schema migration.

---

## Known limitations

1. **No automatic retries yet** — failed sends are logged as `failed` and may be retried on a future manual or scheduled run; no retry loop in the runner.
2. **Allowlist still required/recommended** — `SCHEDULED_EMAIL_ALLOWLIST` is mandatory for `live_send`; keep it minimal in production.
3. **Domain/from-address must be properly verified** — unverified `EMAIL_FROM_ADDRESS` causes provider failures.
4. **Admin visibility is read-only** — Email Automation shows runs and logs; no operational actions from the UI.
5. **No retry UI yet** — operators cannot retry failed deliveries from the browser; re-invoke the runner or fix data manually.

---

## Core verification scripts (Phase 66 gate)

`scripts/verify-v6-production-readiness.mjs` runs static safety posture checks, then orchestrates:

| Script | Phase | Covers |
|--------|-------|--------|
| `verify-scheduled-runner-controlled-live-send` | 61 | Allowlist gates, delivery log audit, no send in dry_run/preview |
| `verify-scheduled-runner-mark-sent-after-delivery` | 62 | Mark-sent only after send + sent log |
| `verify-scheduled-runner-duplicate-prevention` | 63 | Sent-only duplicate check |
| `verify-scheduled-runner-failure-handling` | 64 | Failed logs, retry posture, no mark-sent on failure |
| `verify-automation-visibility-ui` | 65 | Read-only UI, sanitised payload, no execution hooks |

**Phase 66 gate:** `npm run verify-v6-production-readiness` must pass. **Verification only** — no feature code changes required.

---

## Related documentation

- [`v6-automated-email-reminders.md`](v6-automated-email-reminders.md) — phase-by-phase automated reminder history
- [`v6-delivery-architecture.md`](v6-delivery-architecture.md) — delivery domain model and verification index
- [`v6-scheduled-runner.md`](v6-scheduled-runner.md) — runner deploy, modes, and staging smoke tests
- [`v6-email-provider-configuration.md`](v6-email-provider-configuration.md) — provider env contract and Resend plan
