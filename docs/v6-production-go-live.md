# V6 Production Go-Live Preparation

**Theme:** Operator runbook and verification gate for the first controlled production `live_send` — **documentation and verification only**.  
**Phase:** V6 Phase 68  
**Date:** June 2026

---

## Current system status

V6 Phases 45–67 delivered the automated email reminder stack with staging acceptance gates. Phase 66 confirmed safety posture; Phase 67 fixed **staging fixture isolation** so repeat staging acceptance is reliable without weakening duplicate prevention.

**Phase 68 scope:** Prepare operators for production go-live. **Documentation and verification only — no runtime sending behaviour changes.** No new sending, retry, mutation, UI write controls, or Resend behaviour changes.

**Gate command:**

```powershell
npm run verify-v6-production-go-live-readiness
npm run verify-v6-production-readiness
npm run build
```

**Prerequisite:** Phase 67 staging acceptance must pass before production go-live (see [Acceptance evidence from Phase 67](#acceptance-evidence-from-phase-67)).

---

## Required production Supabase secrets

Configure these as **Supabase Edge Function secrets** on `scheduled-reminder-runner`. **Never commit values to git.**

| Secret | Safe default | Production go-live |
|--------|--------------|-------------------|
| `EMAIL_SENDING_ENABLED` | `false` | Set `true` only when deliberately enabling Resend sends |
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `false` | Set `true` only when deliberately enabling scheduled `live_send` |
| `SCHEDULED_EMAIL_ALLOWLIST` | — (unset / empty blocks sends) | Comma-separated production recipient emails; start minimal |
| `EMAIL_FROM_ADDRESS` | — | Verified sender on your production Resend domain |
| `RESEND_API_KEY` | — | Production Resend API key — **server-side only** |
| `SCHEDULED_EMAIL_PREVIEW_ENABLED` | `false` | Leave `false` unless operators need `live_send_preview` in production |

Set secrets via Supabase CLI or dashboard (project → Edge Functions → `scheduled-reminder-runner` → Secrets):

```powershell
supabase secrets set EMAIL_SENDING_ENABLED=false --project-ref <production-ref>
supabase secrets set SCHEDULED_EMAIL_SENDING_ENABLED=false --project-ref <production-ref>
# ... set remaining secrets before go-live
```

**Secret handling rules:**

- **`RESEND_API_KEY` must not be committed** or pasted into chat, docs, `.env` commits, or the browser bundle.
- `js/data/email-provider-env.js` keeps `RESEND_API_KEY: undefined` in git defaults.
- Local `.env` is for staging verification scripts only (`SUPABASE_URL`, keys, `SCHEDULED_TEST_EMAIL_TO`) — not for committing production secrets.

---

## Safe default values

| Setting | Default | Effect when not explicitly enabled |
|---------|---------|-----------------------------------|
| `EMAIL_SENDING_ENABLED` | `false` | `sendReminderEmail` returns disabled — **no Resend HTTP calls** |
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `false` | `live_send` refused with `scheduled_live_send_not_enabled` |
| `SCHEDULED_EMAIL_PREVIEW_ENABLED` | `false` | `live_send_preview` refused |
| `mode` (request body) | `dry_run` | Candidate scan only — **no emails** |
| `SCHEDULED_EMAIL_ALLOWLIST` | empty / unset | All `live_send` candidates skipped (`not_allowlisted`) |

**Production posture before go-live:** Leave both `EMAIL_SENDING_ENABLED` and `SCHEDULED_EMAIL_SENDING_ENABLED` at `false` until the [first live-send checklist](#first-live-send-checklist) is complete.

---

## `EMAIL_SENDING_ENABLED` and `SCHEDULED_EMAIL_SENDING_ENABLED` behaviour

Both gates must be explicitly `true` for scheduled `live_send` to reach Resend. They are independent layers:

| Gate | Scope | When `false` |
|------|-------|--------------|
| `SCHEDULED_EMAIL_SENDING_ENABLED` | `scheduled-reminder-runner` `live_send` mode | Runner refuses `live_send` before candidate processing |
| `EMAIL_SENDING_ENABLED` | Shared `_shared/email-provider.ts` | Provider returns disabled result — no Resend call even if runner reaches `sendReminderEmail` |

**Order of evaluation for `live_send`:**

1. Request must include explicit `mode: "live_send"` (default is `dry_run`).
2. `SCHEDULED_EMAIL_SENDING_ENABLED` must be `true`.
3. `SCHEDULED_EMAIL_ALLOWLIST` must be non-empty; recipient must be on the list.
4. `EMAIL_SENDING_ENABLED` must be `true` at provider invoke time.

**`dry_run` and `live_send_preview`:** Neither mode calls `sendReminderEmail`. Neither requires `EMAIL_SENDING_ENABLED=true` for their primary path. `live_send_preview` requires `SCHEDULED_EMAIL_PREVIEW_ENABLED=true`.

**Emergency disable:** Setting either `EMAIL_SENDING_ENABLED=false` or `SCHEDULED_EMAIL_SENDING_ENABLED=false` stops production `live_send` immediately (see [Emergency disable steps](#emergency-disable-steps)).

---

## `SCHEDULED_EMAIL_ALLOWLIST` transition plan

Recommended **allowlist transition** from staging acceptance to production steady state. The allowlist is **mandatory** for `live_send`. Recipients not on the list receive `delivery_status: skipped` with reason `not_allowlisted` — no provider call.

| Stage | Allowlist contents | Sending gates |
|-------|-------------------|---------------|
| **1. Staging acceptance** | `SCHEDULED_TEST_EMAIL_TO` only | Staging secrets `true` for controlled tests |
| **2. Production deploy (pre-live)** | Empty or operator test addresses only | Both gates `false` |
| **3. Production pilot** | Small set of known safeguarding inboxes (1–5) | Enable gates deliberately; invoke `live_send` manually |
| **4. Wider rollout** | Expand allowlist incrementally | Monitor Email Automation UI (read-only) after each expansion |
| **5. Steady state** | All intended reminder recipients | Keep list reviewed quarterly; remove leavers promptly |

**Rules:**

- Never set `SCHEDULED_EMAIL_ALLOWLIST=*` or wildcard patterns — the runner expects exact comma-separated email addresses.
- Expanding the allowlist does **not** require redeploy; secret update takes effect on next invoke.
- Shrinking the allowlist takes effect immediately — off-list recipients are skipped on the next run.
- Duplicate prevention (Phase 63) still applies: a prior `sent` log for the same keys blocks re-send regardless of allowlist changes.

---

## `RESEND_API_KEY` and sender domain checks

Before first production `live_send`:

### Resend API key

- [ ] Production `RESEND_API_KEY` created in Resend dashboard with **send scope only**
- [ ] Key stored in Supabase Edge secrets — **not** in `.env` commits or client bundle
- [ ] `npm run build` — `app.bundle.js` must not contain `RESEND_API_KEY`
- [ ] Staging key and production key are **separate** (do not reuse staging key in production)

### Sender domain and `EMAIL_FROM_ADDRESS`

- [ ] Production sending domain added and **verified** in Resend (DNS records propagated)
- [ ] `EMAIL_FROM_ADDRESS` uses the verified domain (e.g. `reminders@yourdomain.org`)
- [ ] SPF/DKIM/DMARC aligned with Resend documentation for the domain
- [ ] Test send from Resend dashboard or staging `send-test-email` succeeded before production runner invoke
- [ ] `EMAIL_FROM_ADDRESS` matches the address configured in Supabase Edge secrets for `scheduled-reminder-runner`

**Failure symptom:** Provider failures with domain/sender verification errors appear as `delivery_status: failed` rows — check Email Automation UI and `error_message` (secrets redacted).

---

## First live-send checklist

Complete in order. Do not enable sending gates until all prior items pass.

### Verification gates (local / CI)

- [ ] `npm run verify-v6-production-go-live-readiness` passes
- [ ] `npm run verify-v6-production-readiness` passes
- [ ] `npm run build` passes

### Staging acceptance (Phase 67 evidence)

- [ ] `npm run verify-scheduled-runner-controlled-live-send-staging`
- [ ] `npm run verify-scheduled-runner-mark-sent-after-delivery-staging` (unique fixture per run)
- [ ] `npm run verify-scheduled-runner-duplicate-prevention-staging`
- [ ] `npm run verify-scheduled-runner-failure-handling-staging`
- [ ] `npm run verify-automation-visibility-cloud-load`

### Production configuration

- [ ] `scheduled-reminder-runner` deployed to **production** with Phase 64+ code
- [ ] `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `SCHEDULED_EMAIL_ALLOWLIST` set on production secrets
- [ ] `SCHEDULED_EMAIL_ALLOWLIST` contains only intended pilot recipients
- [ ] `EMAIL_SENDING_ENABLED=false` and `SCHEDULED_EMAIL_SENDING_ENABLED=false` until deliberate enable

### Dry run on production (no sends)

- [ ] Invoke `scheduled-reminder-runner` with `mode: "dry_run"` (or omit mode) — HTTP 200, `automation_runs` + delivery logs created, **no** `sent` rows with `provider_message_id`

### Controlled first `live_send`

- [ ] Set `EMAIL_SENDING_ENABLED=true` then `SCHEDULED_EMAIL_SENDING_ENABLED=true` on production secrets
- [ ] Invoke with explicit `mode: "live_send"` for a known-small candidate set (pilot allowlist)
- [ ] Confirm exactly one `sent` row per allowlisted candidate in Email Automation UI
- [ ] Confirm `mark_reminder_sent` applied only after `sent` delivery log (Phase 62)
- [ ] Confirm non-allowlisted candidates show `skipped` / `not_allowlisted`
- [ ] Record `automation_run_id` and timestamp for audit

### Post-first-send

- [ ] Review `reminder_delivery_logs` for unexpected `failed` rows
- [ ] Confirm no duplicate sends for same compliance keys (Phase 63)
- [ ] Document go-live date and operator in internal runbook

---

## Rollback instructions

Phase 68 adds **verification and documentation only** — rollback is operational, not a schema migration.

| Action | Steps | Data impact |
|--------|-------|-------------|
| **Stop all sends (fastest)** | Set `SCHEDULED_EMAIL_SENDING_ENABLED=false` and `EMAIL_SENDING_ENABLED=false` on production Edge secrets | No new sends; existing audit rows immutable |
| **Revert allowlist expansion** | Update `SCHEDULED_EMAIL_ALLOWLIST` to previous comma-separated list | Off-list recipients skipped on next run |
| **Redeploy prior runner** | Supabase dashboard → Edge Functions → `scheduled-reminder-runner` → deploy previous revision | Code rollback if a bad deploy occurred |
| **Release tag baseline** | **v6.0.0-beta.1** — last tagged RC before V6 automated email Phases 45–68 stack | Reference for known-good source |

Existing `automation_runs` and `reminder_delivery_logs` rows are **immutable audit** — no data rollback required to stop sending.

---

## Emergency disable steps

Use when unintended sends occur, provider errors spike, or operator uncertainty.

1. **Immediately** set on production `scheduled-reminder-runner` secrets:
   - `SCHEDULED_EMAIL_SENDING_ENABLED=false`
   - `EMAIL_SENDING_ENABLED=false`
2. **Verify:** POST `mode: "live_send"` — expect refusal (`scheduled_live_send_not_enabled` or provider disabled) with **no new** `sent` delivery logs.
3. **Optional:** Clear or shrink `SCHEDULED_EMAIL_ALLOWLIST` to empty for defence in depth (skips all candidates if `live_send` is somehow invoked).
4. **Investigate:** Email Automation UI (read-only) — filter latest `automation_runs`, inspect `failed` / `sent` rows.
5. **Communicate:** Notify safeguarding lead; do not delete delivery logs (audit trail).
6. **Re-enable:** Only after root cause identified and [first live-send checklist](#first-live-send-checklist) re-validated.

Secret changes take effect on the **next** Edge Function invoke — no redeploy required.

---

## Acceptance evidence from Phase 67

Phase 67 (**staging fixture isolation**) unblocked repeat staging acceptance for the Phase 62 mark-sent gate without weakening Phase 63 duplicate prevention.

| Evidence | Command / artifact |
|----------|-------------------|
| Unique fixture per run | `verify-scheduled-runner-mark-sent-after-delivery-staging` creates `Phase 62 Test Person <ISO-timestamp>` |
| Organisation | `11111111-1111-1111-1111-111111111111` (Alpha Test Organisation) |
| Recipient | `SCHEDULED_TEST_EMAIL_TO` (single allowlisted address) |
| Assertions | `markedSent = 1`, `sent` delivery log with `provider_message_id`, compliance history updated |
| Isolation rationale | Prior `sent` logs on a fixed fixture blocked repeat runs — timestamped person avoids collision |

**Phase 67 staging gate commands** (must pass before production go-live):

```powershell
npm run verify-scheduled-runner-controlled-live-send-staging
npm run verify-scheduled-runner-mark-sent-after-delivery-staging
npm run verify-scheduled-runner-duplicate-prevention-staging
npm run verify-scheduled-runner-failure-handling-staging
npm run verify-automation-visibility-cloud-load
```

See also [`v6-production-readiness.md`](v6-production-readiness.md) § Staging fixture isolation (Phase 67).

---

## Known limitations

1. **No automatic retries** — failed sends log as `failed`; retry only on a future manual or scheduled run.
2. **Allowlist required** — `SCHEDULED_EMAIL_ALLOWLIST` is mandatory for `live_send`; keep minimal in production.
3. **Domain/from-address must be verified** — unverified `EMAIL_FROM_ADDRESS` causes provider failures.
4. **Admin visibility is read-only** — Email Automation shows runs and logs; no operational actions from the UI.
5. **No retry UI** — operators cannot retry failed deliveries from the browser.
6. **No cron/scheduler wiring in Phase 68** — `live_send` is invoked explicitly; external scheduler is a future slice.
7. **Sequential sends only** — one candidate at a time in `live_send`; no bulk parallel send.

---

## Related documentation

- [`v6-production-readiness.md`](v6-production-readiness.md) — Phase 66 safety gates, staging commands, rollback tags
- [`v6-automated-email-reminders.md`](v6-automated-email-reminders.md) — phase-by-phase automated reminder history
- [`v6-delivery-architecture.md`](v6-delivery-architecture.md) — delivery domain model and verification index
- [`v6-scheduled-runner.md`](v6-scheduled-runner.md) — runner deploy, modes, and staging smoke tests
- [`v6-email-provider-configuration.md`](v6-email-provider-configuration.md) — provider env contract and Resend plan
