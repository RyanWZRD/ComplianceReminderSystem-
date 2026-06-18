# v6.0.0 — Email Provider Configuration

**Theme:** Define how a real email provider will be configured safely — without implementing a provider, sending email, or wiring the application.

**Target:** v6.0.0 (major release)  
**Current phase:** V6 Phase 13 — Provider Foundation Release Readiness  
**Release candidate:** v6.0.0-alpha.2  
**Prerequisites:** v6.0.0-alpha.1 (V6 Phase 9 — delivery foundation release readiness)  
**Date:** Planned — June 2026+

---

## Executive summary

V6 Phases 1–9 established the delivery domain model, record builder, Postgres schema, RPCs, state machine, mock provider, mock executor, and foundation verification. Safeguarding officers can preview reminders and the system can simulate delivery in memory — but no real provider credentials, configuration contract, or outbound path exists yet.

**v6.0.0 Phase 10** introduces the **provider configuration architecture**: documented rules for future Resend, SendGrid, and SMTP integration, plus a read-only config module (`getEmailProviderConfig`) that parses environment variables without sending email.

| V6 Phase 9 (today) | V6 Phase 10 (this document) | V6+ (future) |
|--------------------|----------------------------|--------------|
| Mock provider only | Provider config shape + env contract | Real `EmailProvider` adapter |
| No credentials | Secrets documented — never in client bundle | Worker/Edge Function secrets |
| `enabled: false` default | Safe defaults enforced in config module | Opt-in production sending |
| No app wiring | Config module not imported in `app.js` | Worker reads config at startup |

**Non-goals for Phase 10:** Real provider SDK integration, outbound delivery, send button UI, mark-as-sent automation, Edge Functions, or compliance/action/history mutation.

---

## Supported future provider options

Email sending will sit behind the `EmailProvider` interface defined in [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md). Phase 10 documents three candidate providers; only one may be active per deployment.

| Provider | Identifier (`EMAIL_PROVIDER`) | Typical use | Notes |
|----------|----------------------------|-------------|-------|
| **None** | `none` (default) | Disabled / local dev | No outbound email; safe committed default |
| **Resend** | `resend` | Cloud transactional email | HTTPS API; domain verification required |
| **SendGrid** | `sendgrid` | Cloud transactional email | HTTPS API; sender authentication required |
| **SMTP** | `smtp` | Self-hosted or relay | STARTTLS/TLS relay; higher operational burden |

**Selection rules (future implementation):**

- Exactly one provider per worker/deployment
- `EMAIL_PROVIDER=none` or unset → delivery worker must not call any provider
- Provider choice is environment-scoped (staging vs production), not per-organisation in Phase 10
- Mock provider (`createMockEmailProvider`) remains for tests and verification — separate from production config

---

## Required environment variables

Configuration is **server-side only** (Supabase Edge Function secrets, worker env, CI verify env). Never commit secrets or expose them in the browser bundle.

### Core settings

| Variable | Required when | Default | Description |
|----------|---------------|---------|-------------|
| `EMAIL_PROVIDER` | Optional | `none` | `none`, `resend`, `sendgrid`, or `smtp` |
| `EMAIL_MODE` | Optional | `disabled` | `disabled`, `test`, or `production` |
| `EMAIL_PROVIDER_ENABLED` | Optional | *(unset → false)* | Must be `true` to allow sending (explicit opt-in) |
| `EMAIL_FROM_ADDRESS` | When enabled | — | Verified sender address (From header) |
| `EMAIL_REPLY_TO_ADDRESS` | Optional | — | Reply-To header; falls back to org safeguarding inbox policy (future) |
| `EMAIL_RATE_LIMIT_PER_RUN` | Optional | `50` | Max sends per automation/delivery run |

### Provider-specific secrets (future — never in client)

| Provider | Variables | Notes |
|----------|-----------|-------|
| **Resend** | `RESEND_API_KEY` | API key with send scope only |
| **SendGrid** | `SENDGRID_API_KEY` | API key restricted to Mail Send |
| **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | `SMTP_SECURE=true` for TLS on port 465 |

**Phase 10:** `getEmailProviderConfig(env)` reads **non-secret** core settings only. API keys are validated by the future provider adapter at worker startup — not returned by the config module.

---

## Sender address rules

The **From** address represents the organisation's compliance reminder service. Misconfiguration can cause deliverability failures or impersonation risk.

| Rule | Requirement |
|------|-------------|
| **Verified domain** | `EMAIL_FROM_ADDRESS` must use a domain verified with the chosen provider (SPF/DKIM/DMARC aligned) |
| **No personal inboxes** | Do not use individual staff Gmail/Outlook addresses as From — use `reminders@yourorg.org` or similar |
| **Stable display name** | Future adapter may set `From: "Org Name Compliance" <reminders@org>` — display name from org settings |
| **Required when enabled** | If `EMAIL_PROVIDER_ENABLED=true`, `EMAIL_FROM_ADDRESS` must be a valid RFC 5322 addr-spec; worker startup fails otherwise |
| **Test mode** | In `test` mode, From may use provider sandbox domains (e.g. Resend test) — document in runbook per provider |
| **Normalisation** | Trim whitespace; lowercase domain part; reject empty or malformed addresses at config validation |

---

## Reply-To address rules

Reply-To directs safeguarding staff responses away from no-reply inboxes when appropriate.

| Rule | Requirement |
|------|-------------|
| **Optional** | `EMAIL_REPLY_TO_ADDRESS` may be unset; future default: organisation safeguarding contact email from settings |
| **Must be monitored** | If set, must be a mailbox staffed by safeguarding/compliance team |
| **Distinct from From** | Recommended: From = automated service; Reply-To = human safeguarding inbox |
| **Same verification** | Reply-To domain should not trigger spam filters; provider may not require verification for Reply-To |
| **GDPR** | Reply-To may receive personal data in replies — retention and access policies apply (see below) |

---

## Test mode vs production mode

`EMAIL_MODE` controls whether outbound email reaches real recipients.

| Mode | `EMAIL_MODE` | Behaviour (future) |
|------|--------------|-------------------|
| **Disabled** | `disabled` (default) | No provider calls; config module returns `enabled: false` unless explicitly overridden with invalid combo |
| **Test** | `test` | Provider sandbox or redirect-all-to override; delivery records still written; no production recipient delivery |
| **Production** | `production` | Real sends to `recipientEmail` on prepared records; full audit trail |

**Safe defaults (Phase 10 config module):**

```json
{
  "provider": "none",
  "mode": "disabled",
  "fromEmail": null,
  "replyToEmail": null,
  "rateLimitPerRun": 50,
  "enabled": false
}
```

**Enabling production sends (future) requires all of:**

1. `EMAIL_PROVIDER` ∈ `{ resend, sendgrid, smtp }`
2. `EMAIL_MODE=production`
3. `EMAIL_PROVIDER_ENABLED=true`
4. Valid `EMAIL_FROM_ADDRESS` and provider credentials present in worker secrets
5. `AUTOMATION_ENABLED=true` and cloud backend (delivery is cloud-only per V5/V6 architecture)

**Test mode safeguards (future):**

- Optional `EMAIL_TEST_REDIRECT_TO` — all recipients replaced with a single staging inbox
- Provider-level sandbox API keys where supported
- Operations Log marks test sends in `metadata.testMode: true`

---

## Rate limits

Rate limits protect provider quotas, reduce abuse risk, and keep automation runs bounded.

| Limit | Default | Scope | Notes |
|-------|---------|-------|-------|
| `EMAIL_RATE_LIMIT_PER_RUN` | `50` | Per automation/delivery worker invocation | Config module exposes; executor enforces (future) |
| Per-organisation daily cap | `500` (planned) | Org-scoped counter in worker | Prevents runaway digests |
| Provider backoff | Per retry strategy | Transient failures | See [`v6-delivery-architecture.md`](v6-delivery-architecture.md) retry section |

**Phase 10:** Only `rateLimitPerRun` is defined in config shape. Executor and worker enforcement are future phases.

When the limit is reached mid-run:

1. Stop attempting new sends in the current run
2. Leave remaining records in `prepared` (or `queued`)
3. Record audit event `delivery.rate_limited`
4. Surface in Operations Log for admin review

---

## Provider health checks

The `EmailProvider.healthCheck()` contract (see delivery architecture) validates credentials and reachability **before** processing a delivery batch.

| Check | When | Pass criteria | Failure behaviour |
|-------|------|---------------|-------------------|
| **Startup health** | Worker / Edge Function cold start | `healthCheck().ok === true` | Log error; do not transition records to `sending` |
| **Periodic health** | Optional cron heartbeat (e.g. every 15 min) | Latency & auth OK | Alert ops; existing in-flight sends follow retry policy |
| **Pre-batch health** | Before each delivery run (recommended) | Provider responds within timeout (e.g. 5s) | Abort run; automation run marked with warning |

**Health check must not send email** — use provider ping/metadata endpoints only.

**Mock provider (Phase 6):** `createMockEmailProvider().healthCheck()` returns `{ status: "ok", provider: "mock" }` for tests.

**Future real providers:**

| Provider | Health approach |
|----------|-----------------|
| Resend | API key validation / domains list endpoint |
| SendGrid | API key scopes check |
| SMTP | TCP connect + AUTH without sending DATA |

---

## Secret and API key handling

| Rule | Requirement |
|------|-------------|
| **Storage** | Supabase Edge Function secrets, platform env vars, or secrets manager — never `localStorage`, repo, or client bundle |
| **Not in config return** | `getEmailProviderConfig()` returns operational settings only — no API keys |
| **Rotation** | Support key rotation without code deploy; document runbook for dual-key window |
| **Least privilege** | API keys scoped to send-only; no account admin permissions |
| **Logging** | Never log full API keys, SMTP passwords, or Authorization headers |
| **CI verify** | Verification scripts use empty env; no live credentials in git |
| **Local dev** | Default `enabled: false`; developers use mock provider for delivery flow tests |

---

## Audit requirements

Provider configuration changes and delivery attempts must remain auditable per V6 delivery architecture.

| Event | When | Retained data |
|-------|------|---------------|
| `provider.config_loaded` | Worker startup | `provider`, `mode`, `enabled`, `rateLimitPerRun` — **not** secrets |
| `provider.health_check` | Startup / pre-batch | `ok`, `latencyMs`, `errorMessage` (sanitised) |
| `delivery.created` … `delivery.delivered` / `delivery.failed` | Per send attempt | Full delivery record in `reminder_delivery_logs` |
| `delivery.rate_limited` | Cap reached | Run id, limit, skipped count |

**Configuration-only Phase 10:**

- No runtime audit events yet
- Future worker must log config snapshot (redacted) on startup
- Config changes require deployment/secret update — track via infrastructure change log

**No silent failures:** If provider is misconfigured (`enabled: true` but missing credentials), worker must fail loudly at startup or pre-batch health — not attempt sends that cannot be audited.

---

## GDPR and data handling notes

Reminder email involves **personal data** (recipient addresses, names in subject/body, compliance context).

| Topic | Requirement |
|-------|-------------|
| **Lawful basis** | Document organisational lawful basis (typically legitimate interest for safeguarding compliance reminders) in privacy policy |
| **Data minimisation** | Send only fields required for the reminder; no unnecessary PII in metadata |
| **Recipient email** | Stored in `reminder_delivery_logs.recipient_email` — personal data subject to retention policy |
| **Provider subprocessors** | Resend/SendGrid/SMTP host are processors — maintain DPA and subprocessor list |
| **Retention** | Align delivery log retention with V5-4D operations pack policy; default retention TBD per org tier |
| **Right to erasure** | Erasure requests must anonymise or purge `recipient_email`, `subject`, `body_text` while retaining aggregate audit metadata where legally required |
| **Reply-To replies** | Inbound replies may contain special-category data — separate mailbox retention policy |
| **Test mode** | Test redirects must not use real data subjects' inboxes without consent |
| **Cross-border** | Document provider data residency (EU/US) for UK GDPR compliance |

---

## Config module

**Module:** `js/app/automation/email-provider-config.js`

**Function:** `getEmailProviderConfig(env?)`

Parses environment-backed settings and returns a safe configuration object. Does not validate credentials, call providers, or send email.

### Return shape

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `string` | `"none"` | `none`, `resend`, `sendgrid`, or `smtp` |
| `mode` | `string` | `"disabled"` | `disabled`, `test`, or `production` |
| `fromEmail` | `string \| null` | `null` | From address when set |
| `replyToEmail` | `string \| null` | `null` | Reply-To when set |
| `rateLimitPerRun` | `number` | `50` | Per-run send cap |
| `enabled` | `boolean` | `false` | `true` only with explicit `EMAIL_PROVIDER_ENABLED=true` plus valid provider and non-disabled mode |

### Phase 10 constraints

- Configuration shape only — no provider implementation, no sending, no mark-as-sent automation
- Not imported in `app.js` or bundled for browser delivery paths
- No `fetch`, SMTP, or external network calls in the module
- No compliance/action/history mutation

---

## Provider adapter factory

**Module:** `js/app/automation/email-provider-adapter.js`

**Function:** `createEmailProviderAdapter({ config, mockProvider })`

Resolves `getEmailProviderConfig()` output (or an explicit config object) into a provider surface with `healthCheck()` and `sendReminder()`. Interface/factory only — no real provider SDKs, network calls, or outbound delivery.

### Resolution rules

| Condition | Adapter returned | `healthCheck()` | `sendReminder()` |
|-----------|------------------|-----------------|------------------|
| `config.enabled === false` | Disabled provider | `{ status: "disabled", provider: "none" }` | Throws `Email provider is disabled` |
| `config.provider === "mock"` (enabled) | Injected `mockProvider` or `createMockEmailProvider({ mode: "success" })` | Mock provider result | Mock provider result |
| `config.provider` ∈ `{ resend, sendgrid, smtp }` (enabled) | Placeholder provider | `{ status: "not_implemented", provider: <name> }` | Throws `Provider <name> is not implemented yet` |
| Other (e.g. `none` while enabled) | Disabled provider | `{ status: "disabled", provider: "none" }` | Throws `Email provider is disabled` |

The `mock` provider identifier is for tests and verification only — not set via production `EMAIL_PROVIDER` env in Phase 11.

### Phase 11 constraints

- Interface/factory only — no real Resend/SendGrid/SMTP implementation
- Not imported in `app.js` or wired to delivery execution
- No `fetch`, SMTP, external SDKs, or network calls
- No mark-as-sent automation or compliance/action/history mutation

---

## Verification

| Command | Scope |
|---------|-------|
| `npm run verify-email-provider-config` | Phase 10 — documentation, config module, safe defaults, no app wiring |
| `npm run verify-email-provider-adapter` | Phase 11 — adapter factory, disabled/mock/placeholder behaviour, no app wiring |
| `npm run verify-email-provider-foundation` | Phase 12 — orchestrator; runs phases 10–11 + delivery foundation in order, stop on first failure |
| `npm run verify-delivery-foundation` | Phases 1–8 — delivery foundation orchestrator (included in Phase 12 gate) |

**Phase 10 gate:** `npm run verify-email-provider-config` must pass. No Supabase, browser, real email provider, or outbound delivery.

**Phase 11 gate:** `npm run verify-email-provider-adapter` must pass. Interface/factory only — no real provider implementation, network calls, or `app.js` wiring.

**Phase 12 gate:** `npm run verify-email-provider-foundation` must pass. Verification orchestration only — no real provider implementation, network calls, production sending, mark-as-sent automation, or app behaviour changes.

**Phase 13 gate:** `npm run build` and `npm run verify-email-provider-foundation` must pass. Documentation and version bump only — no application logic changes.

---

## Phase roadmap (v6 — provider track)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 10 | Provider configuration architecture (`getEmailProviderConfig`) | **Complete** |
| 11 | Provider adapter interface (`createEmailProviderAdapter`) | **Complete** |
| 12 | Provider foundation verification orchestrator (`verify-email-provider-foundation`) | **Complete** |
| 13 | Provider foundation release readiness (`v6.0.0-alpha.2`) | **Complete** |
| 14 | Real provider implementation (e.g. Resend) | Planned |
| 15 | Operations Log delivery UI + export | Planned |
| 16 | Mark-as-sent on confirmed delivery (policy-gated) | Planned |

**Release candidate:** **v6.0.0-alpha.2**

**Release-readiness note (v6.0.0-alpha.2):**

- V6 Phases 1–13 complete
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider foundation verification orchestrator complete (`npm run verify-email-provider-foundation`)
- Disabled-by-default provider mode
- Mock provider only
- No real provider implementation
- No production sending
- No mark-as-sent automation

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-foundation` — phases 10–12 orchestrator (no live execution)

**Next slice after Phase 13:** V6 Phase 14 — real provider implementation.
