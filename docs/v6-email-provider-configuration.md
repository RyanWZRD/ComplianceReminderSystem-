# v6.0.0 — Email Provider Configuration

**Theme:** Define how a real email provider will be configured safely — without implementing a provider, sending email, or wiring the application.

**Target:** v6.0.0 (major release)  
**Current phase:** V6 Phase 23 — Delivery Operations Log Release Readiness  
**Release candidate:** v6.0.0-alpha.6  
**Prerequisites:** v6.0.0-alpha.2 (V6 Phase 13 — provider foundation release readiness)  
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
| `config.provider` ∈ `{ sendgrid, smtp }` (enabled) | Skeleton provider module | `{ status: "not_implemented", provider: <name> }` | Throws `Provider <name> is not implemented yet` |
| `config.provider === "resend"` (enabled, invalid config) | Resend provider module | `{ status: "invalid_config", provider: "resend" }` | Throws configuration error |
| `config.provider === "resend"` (enabled, valid config) | Resend provider module | `{ status: "ok", provider: "resend", mode }` | Resend `sendReminder()` (requires `fetchImpl` at send time) |
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
| `npm run verify-email-provider-skeletons` | Phase 14 — skeleton provider modules, adapter routing, no network/SDK hooks, no app wiring |
| `npm run verify-email-provider-skeleton-foundation` | Phase 15 — orchestrator; runs phases 12 + 14 in order, stop on first failure |
| `npm run verify-resend-provider-plan` | Phase 17 — Resend implementation plan documentation |
| `npm run verify-resend-provider` | Phase 19 — Resend provider network implementation (mocked `fetchImpl`; no app wiring) |
| `npm run verify-resend-provider-foundation` | Phase 20 — orchestrator; runs skeleton foundation + Resend plan + Resend provider in order, stop on first failure |
| `npm run verify-delivery-operations-log-ui` | Phase 22 — Delivery Operations Log UI, CSV export, no execution hooks |
| `npm run verify-delivery-foundation` | Phases 1–8 — delivery foundation orchestrator (included in Phase 12 gate) |

**Phase 10 gate:** `npm run verify-email-provider-config` must pass. No Supabase, browser, real email provider, or outbound delivery.

**Phase 11 gate:** `npm run verify-email-provider-adapter` must pass. Interface/factory only — no real provider implementation, network calls, or `app.js` wiring.

**Phase 12 gate:** `npm run verify-email-provider-foundation` must pass. Verification orchestration only — no real provider implementation, network calls, production sending, mark-as-sent automation, or app behaviour changes.

**Phase 13 gate:** `npm run build` and `npm run verify-email-provider-foundation` must pass. Documentation and version bump only — no application logic changes.

**Phase 14 gate:** `npm run verify-email-provider-skeletons` must pass. Skeleton modules only — no fetch, API keys, SDKs, SMTP transport, real sending, mark-as-sent automation, or `app.js` wiring.

**Phase 15 gate:** `npm run verify-email-provider-skeleton-foundation` must pass. Verification orchestration only — no real provider implementation, network calls, production sending, mark-as-sent automation, or app behaviour changes.

**Phase 16 gate:** `npm run build` and `npm run verify-email-provider-skeleton-foundation` must pass. Documentation and version bump only — no application logic changes.

**Phase 17 gate:** `npm run verify-resend-provider-plan` must pass. Planning documentation only — no real provider implementation, `fetch`, SDK, SMTP, production sending, or `app.js` wiring.

**Phase 18 gate:** `npm run build`, `npm run verify-email-provider-skeleton-foundation`, and `npm run verify-resend-provider-plan` must pass. Documentation and version bump only — no application logic changes. Resend plan complete; no network implementation, API key usage, production sending, or mark-as-sent automation.

**Phase 19 gate:** `npm run verify-resend-provider` must pass. Resend provider module only — injected `fetchImpl`, no global `fetch`, no `app.js` wiring, no production automation path, no mark-as-sent automation.

**Phase 20 gate:** `npm run verify-resend-provider-foundation` must pass. Verification orchestration only — no app behaviour changes, `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation.

**Phase 21 gate:** `npm run build` and `npm run verify-resend-provider-foundation` must pass. Documentation and version bump only — no application logic changes. Isolated Resend provider complete; no `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation.

**Phase 22 gate:** `npm run verify-delivery-operations-log-ui` must pass. Read-only audit UI and CSV export only — no send button, delivery execution, mark-as-sent automation, or provider `sendReminder` calls.

**Phase 23 gate:** `npm run build`, `npm run verify-resend-provider-foundation`, and `npm run verify-delivery-operations-log-ui` must pass. Documentation and version bump only — no application logic changes. Delivery Operations Log UI complete; no send/retry/execute controls, mark-as-sent automation, or automatic delivery execution.

---

## Real provider skeleton modules

**Phase 14** adds placeholder provider modules for future SendGrid and SMTP integration, and the Resend provider module (network implementation added in Phase 19). Each module exports a factory and exposes `healthCheck()` and `sendReminder()`. The adapter routes enabled `resend`, `sendgrid`, and `smtp` config to these modules.

| Provider | Module | Factory | Status |
|----------|--------|---------|--------|
| Resend | `js/app/automation/providers/resend-provider.js` | `createResendEmailProvider({ config, fetchImpl })` | **Implemented** (Phase 19) |
| SendGrid | `js/app/automation/providers/sendgrid-provider.js` | `createSendgridEmailProvider({ config })` | Skeleton |
| SMTP | `js/app/automation/providers/smtp-provider.js` | `createSmtpEmailProvider({ config })` | Skeleton |

### Skeleton behaviour

| Method | Result |
|--------|--------|
| `healthCheck()` | `{ status: "not_implemented", provider: "<provider>" }` |
| `sendReminder()` | Throws `Provider <provider> is not implemented yet` |

### Phase 14 constraints

- Skeleton modules only — no fetch, API keys, external SDKs, SMTP transport, or real sending
- Not imported in `app.js` or wired to delivery execution
- No mark-as-sent automation or compliance/action/history mutation
- Mock provider (`createMockEmailProvider`) unchanged

---

## Provider skeleton foundation verification orchestrator

**Phase 15** adds one verification command proving provider config, adapter, skeleton modules, and delivery foundation all remain safe before real provider implementation.

**Script:** `scripts/verify-email-provider-skeleton-foundation.mjs`

`npm run verify-email-provider-skeleton-foundation` runs verification scripts in order:

1. `verify-email-provider-foundation` (phases 10–12 + delivery foundation)
2. `verify-email-provider-skeletons` (phase 14 skeleton modules)

Stops on first failure. Prints section headings for each step. Verification-only — no app behaviour changes.

### Phase 15 constraints

- Orchestration only — no app behaviour changes
- No real email provider, production delivery, or mark-as-sent automation
- No network calls or compliance/action/history mutation

---

## Phase roadmap (v6 — provider track)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 10 | Provider configuration architecture (`getEmailProviderConfig`) | **Complete** |
| 11 | Provider adapter interface (`createEmailProviderAdapter`) | **Complete** |
| 12 | Provider foundation verification orchestrator (`verify-email-provider-foundation`) | **Complete** |
| 13 | Provider foundation release readiness (`v6.0.0-alpha.2`) | **Complete** |
| 14 | Real provider skeleton modules (Resend, SendGrid, SMTP) | **Complete** |
| 15 | Provider skeleton foundation verification orchestrator (`verify-email-provider-skeleton-foundation`) | **Complete** |
| 16 | Provider skeleton release readiness (`v6.0.0-alpha.3`) | **Complete** |
| 17 | Resend implementation plan (documentation + verification) | **Complete** |
| 18 | Resend plan release readiness (`v6.0.0-alpha.4`) | **Complete** |
| 19 | Resend network implementation (`createResendEmailProvider`) | **Complete** |
| 20 | Resend provider foundation verification orchestrator (`verify-resend-provider-foundation`) | **Complete** |
| 21 | Resend provider release readiness (`v6.0.0-alpha.5`) | **Complete** |
| 22 | Delivery Operations Log UI + export | **Complete** |
| 23 | Delivery Operations Log release readiness (`v6.0.0-alpha.6`) | **Complete** |
| 24 | Worker delivery execution wiring | Planned |
| 25 | Mark-as-sent on confirmed delivery (policy-gated) | Planned |

**Release candidate:** **v6.0.0-alpha.6**

**Release-readiness note (v6.0.0-alpha.6):**

- V6 Phases 1–23 complete
- Delivery Operations Log UI complete (read-only audit view, summary counts, expandable detail panel)
- CSV export complete
- Loads via `get_reminder_delivery_logs` RPC (read-only)
- **No send/retry/execute controls**
- **No mark-as-sent automation**
- **No automatic delivery execution**
- **No compliance/action/history mutation**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — Resend provider foundation still safe
- `npm run verify-delivery-operations-log-ui` — read-only audit UI and CSV export; no execution hooks

**Next slice after Phase 23:** V6 Phase 24 — Worker delivery execution wiring.

---

## Phase 17 — Resend implementation plan

**Scope:** Document the exact implementation contract for the first real email provider (Resend) before writing network code. **Planning only** — no `fetch`, SDK, SMTP transport, production sending, or `app.js` wiring in this phase.

**Target module:** `js/app/automation/providers/resend-provider.js` (`createResendEmailProvider`)

**API reference:** [Resend Emails API](https://resend.com/docs/api-reference/emails/send-email) · [Resend Domains API](https://resend.com/docs/api-reference/domains/list-domains)

**Non-goals for Phase 17:** Implementing `healthCheck()` / `sendReminder()`, adding dependencies, worker wiring, delivery executor changes, mark-as-sent automation, or compliance/action/history mutation.

### Why Resend first

| Factor | Rationale |
|--------|-----------|
| **HTTPS API** | Single `POST /emails` endpoint — no SMTP connection pooling or TLS relay complexity |
| **Health without send** | `GET /domains` validates API key and domain readiness without delivering mail |
| **Transactional focus** | Fits compliance reminder use case; no marketing-campaign surface area |
| **Skeleton exists** | Phase 14 placeholder module and adapter routing already in place |

SendGrid and SMTP remain documented for future phases; only Resend is planned in detail here.

### Required environment variables

Resend integration reads **core settings** from `getEmailProviderConfig()` (Phase 10) plus **worker-only secrets** validated at adapter startup — secrets are never returned by the config module or exposed to the browser.

| Variable | Required when | Default | Description |
|----------|---------------|---------|-------------|
| `EMAIL_PROVIDER` | Resend active | `none` | Must be `resend` |
| `EMAIL_MODE` | Resend active | `disabled` | `test` or `production` (see gates below) |
| `EMAIL_PROVIDER_ENABLED` | Sending allowed | *(unset → false)* | Must be `true` |
| `EMAIL_FROM_ADDRESS` | `enabled=true` | — | Verified sender on a Resend domain (From header) |
| `EMAIL_REPLY_TO_ADDRESS` | Optional | — | Reply-To header when set |
| `EMAIL_RATE_LIMIT_PER_RUN` | Optional | `50` | Per-run cap (executor enforces) |
| `RESEND_API_KEY` | `provider=resend` + enabled | — | Worker secret; send-scoped API key |
| `EMAIL_TEST_REDIRECT_TO` | Recommended in `test` mode | — | Staging inbox; replaces all `recipientEmail` values before API call |

**Startup validation (Phase 19 implementation):**

1. When `config.provider === "resend"` and `config.enabled === true`, worker must read `RESEND_API_KEY` from env/secrets.
2. Missing or empty `RESEND_API_KEY` → startup failure with sanitised error (no key material in logs).
3. `RESEND_API_KEY` must not appear in `getEmailProviderConfig()` return value, client bundle, or audit payloads.

### From and Reply-To validation

Validation runs at **worker startup** (config + secrets) and **per send** (defence in depth). Uses the same RFC 5322 addr-spec rules as Phase 10.

| Field | Startup rules | Per-send rules |
|-------|---------------|----------------|
| **From (`EMAIL_FROM_ADDRESS`)** | Required when enabled; trim whitespace; lowercase domain part; reject malformed addr-spec | Must match startup-validated value from config (no runtime override) |
| **From domain** | Domain part must appear in Resend `GET /domains` response with `status: "verified"` (health check) | Reject send if domain verification lost since startup (re-run health or fail permanent) |
| **Display name** | Optional future: `"Org Name Compliance" <reminders@org>` from org settings — Phase 19 may send addr-spec only | N/A |
| **Reply-To (`EMAIL_REPLY_TO_ADDRESS`)** | Optional; if set, valid addr-spec; trim and normalise domain | Include `reply_to` in API payload only when set; omit field when null |
| **Distinct addresses** | Recommended: From = automated service; Reply-To = staffed safeguarding inbox | Log warning (not block) if From === Reply-To |

**Rejected at startup (permanent — do not attempt sends):**

- Empty or malformed `EMAIL_FROM_ADDRESS` when `enabled=true`
- From domain not verified in Resend account (health check failure)
- `EMAIL_FROM_ADDRESS` using a personal freemail domain (e.g. `@gmail.com`) — document in runbook; optional strict reject

**Test mode exception:** When `EMAIL_MODE=test`, From may use Resend onboarding domain `onboarding@resend.dev` only if explicitly documented in staging runbook and `EMAIL_TEST_REDIRECT_TO` is set — production From rules still apply when `EMAIL_MODE=production`.

### Test mode behaviour

When `EMAIL_MODE=test` and all enablement gates pass, the Resend adapter **may** call the Resend API but **must not** deliver to real data-subject inboxes.

| Rule | Behaviour |
|------|-----------|
| **Recipient override** | Replace `recipientEmail` with `EMAIL_TEST_REDIRECT_TO` before `POST /emails` |
| **Missing redirect** | If `EMAIL_TEST_REDIRECT_TO` unset → treat as misconfiguration; `healthCheck()` fails or send throws permanent error |
| **Subject prefix** | Prepend `[TEST]` to subject line for visual filtering in staging inbox |
| **Metadata flag** | Set `metadata.testMode: true` on delivery record and in Resend `tags` / custom headers where supported |
| **API key** | Use staging Resend API key (separate from production key) |
| **Audit** | Full delivery lifecycle written to `reminder_delivery_logs`; Operations Log shows test badge |
| **No mark-as-sent** | Test sends do not trigger mark-as-sent automation (Phase 20) |

### Production mode gates

All gates must pass before the worker transitions any record to `sending` with the Resend adapter:

| # | Gate | Check |
|---|------|-------|
| 1 | Provider selection | `EMAIL_PROVIDER=resend` |
| 2 | Explicit enablement | `EMAIL_PROVIDER_ENABLED=true` |
| 3 | Mode | `EMAIL_MODE=production` |
| 4 | From address | Valid `EMAIL_FROM_ADDRESS` on verified Resend domain |
| 5 | API key | `RESEND_API_KEY` present in worker secrets |
| 6 | Automation | `AUTOMATION_ENABLED=true` (cloud worker only per V5/V6 architecture) |
| 7 | Health | `healthCheck().ok === true` within timeout (e.g. 5s) before batch |
| 8 | Rate limit | Under `EMAIL_RATE_LIMIT_PER_RUN` and per-org daily cap (future) |

**Fail-closed:** If any gate fails at startup → worker logs error and refuses to send. If gate fails mid-run (e.g. health check) → abort batch; leave records in `prepared`; emit `provider.health_check` audit event.

**Production sends** use real `recipientEmail` from prepared delivery records — no redirect override.

### Failure mapping

Map Resend HTTP responses and client errors to `SendReminderResult` for the delivery executor retry logic (see [`v6-delivery-architecture.md`](v6-delivery-architecture.md) retry section).

| Resend condition | HTTP | `errorCode` | `transient` | Executor action |
|------------------|------|-------------|-------------|-----------------|
| Success | `200` / `201` | — | — | `delivered`; store `providerMessageId` from response `id` |
| Rate limited | `429` | `resend_rate_limited` | `true` | Backoff + retry; respect `Retry-After` when present |
| Server error | `500`–`599` | `resend_server_error` | `true` | Backoff + retry |
| Timeout / network | — | `resend_network_error` | `true` | Backoff + retry |
| Invalid API key | `401` | `resend_auth_failed` | `false` | `failed` immediately; alert ops |
| Forbidden / scope | `403` | `resend_forbidden` | `false` | `failed` immediately |
| Validation (bad payload) | `422` | `resend_validation_error` | `false` | `failed`; include sanitised Resend message in `failureReason` |
| Invalid recipient | `422` (email field) | `resend_invalid_recipient` | `false` | `failed` immediately |
| Domain not verified | `403` / domain error body | `resend_domain_not_verified` | `false` | `failed`; re-run health check |
| Unknown | other | `resend_unknown_error` | `false` | `failed`; log response status for ops |

**`healthCheck()` mapping:**

| Condition | `ok` | `errorMessage` |
|-----------|------|----------------|
| `GET /domains` succeeds, From domain verified | `true` | — |
| `401` / missing key | `false` | `Resend API key invalid or missing` |
| From domain not in verified list | `false` | `From domain not verified in Resend` |
| Timeout | `false` | `Resend health check timed out` |

Never log full API key or `Authorization` header. Sanitise Resend error bodies before persisting to `failureReason`.

### Rate limits

Resend enforces account-level quotas; the adapter and executor apply **application-level** caps first.

| Layer | Limit | Enforcement |
|-------|-------|-------------|
| **Per-run** | `EMAIL_RATE_LIMIT_PER_RUN` (default `50`) | Executor stops new sends; records stay `prepared`; audit `delivery.rate_limited` |
| **Per-org daily** | `500` (planned) | Worker counter; skip with audit event |
| **Resend account** | Provider quota (plan-dependent) | `429` → transient failure mapping above |
| **Health check** | 1 request per startup / pre-batch | Does not count toward send quota |
| **Backoff** | `initialBackoffMs` 60s, `maxBackoffMs` 15m, `maxAttempts` 3 | Executor retry strategy |

When Resend returns `429`, prefer `Retry-After` header for backoff duration; fall back to exponential backoff from delivery architecture defaults.

### Audit logging

Every Resend interaction must produce auditable records per V6 delivery architecture. No fire-and-forget sends.

| Event | When | Payload (redacted) |
|-------|------|-------------------|
| `provider.config_loaded` | Worker startup | `provider: "resend"`, `mode`, `enabled`, `fromEmail`, `rateLimitPerRun` — **no** `RESEND_API_KEY` |
| `provider.health_check` | Startup / pre-batch | `ok`, `latencyMs`, `errorMessage` |
| `delivery.sending` | Before `POST /emails` | `deliveryId`, `recipientEmail` (or redirect in test mode), `subject` hash optional |
| `delivery.delivered` | Resend `200`/`201` | `providerMessageId`, `deliveredAt` |
| `delivery.failed` | Permanent or exhausted retries | `failureReason`, `errorCode`, attempt count |
| `delivery.rate_limited` | Cap reached | Run id, limit, skipped count |

**Resend API payload audit:** Store `providerMessageId` (Resend email `id`) on the delivery record. Do not store full request/response bodies in metadata — subject/body already on `reminder_delivery_logs`.

**Test mode:** Include `metadata.testMode: true` and `metadata.originalRecipient` (production gate only — omit in production sends for data minimisation unless ops require).

### Rollback plan

If Resend integration causes incidents in staging or production, operators can revert without code deploy in most cases.

| Step | Action | Effect |
|------|--------|--------|
| 1 | Set `EMAIL_PROVIDER_ENABLED=false` | Immediate stop — adapter disabled; `sendReminder` throws / worker skips sends |
| 2 | Set `EMAIL_MODE=disabled` | Config layer treats sending as off |
| 3 | Set `EMAIL_PROVIDER=none` | Adapter resolves to disabled provider |
| 4 | Remove / rotate `RESEND_API_KEY` | Health check fails; pre-batch abort |
| 5 | Redeploy previous worker image | Reverts to skeleton `not_implemented` if Phase 19 code deployed |
| 6 | Records in `sending` | Worker must transition to `failed` with `failureReason: "provider_disabled_rollback"` or allow timeout/retry policy — document runbook |

**Verification after rollback:**

- `npm run verify-email-provider-skeleton-foundation` passes
- Operations Log shows no new `delivered` records after disable timestamp
- Mock provider tests remain green for in-memory delivery flow

**Phase 17:** Rollback is documented only. No runtime rollback automation.

### Phase 19 implementation checklist (future)

Use this ordered checklist when implementing network code in the next phase:

1. Add `RESEND_API_KEY` validation in `createResendEmailProvider` constructor (throw at factory time if missing when enabled)
2. Implement `healthCheck()` via `GET https://api.resend.com/domains` with `Authorization: Bearer <key>`
3. Implement `sendReminder()` via `POST https://api.resend.com/emails` with `from`, `to`, `subject`, `text`, optional `reply_to`
4. Apply test-mode recipient override and `[TEST]` subject prefix
5. Map HTTP status codes per failure mapping table above
6. Return `{ success, providerMessageId, errorCode, errorMessage, transient }` shape aligned with mock provider contract
7. Extend `verify-email-provider-skeletons` or add `verify-resend-provider` with mocked `fetch` — no live API calls in CI
8. Do not wire to `app.js` until delivery worker phase

### Phase 17 constraints

- Planning documentation and verification script only
- `resend-provider.js` remains skeleton (`not_implemented` / throws)
- No `fetch`, Resend SDK, API keys in repo, SMTP, production sending, or `app.js` wiring
- No mark-as-sent automation or compliance/action/history mutation

---

## Phase 18 — Resend plan release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.4`), and release-readiness gate for the Resend implementation plan slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.4):**

- V6 Phases 1–18 complete
- Resend implementation plan complete (Phase 17)
- Resend plan verification complete (`npm run verify-resend-provider-plan`)
- Provider skeleton modules unchanged — `resend-provider.js` still `not_implemented`
- Disabled-by-default provider mode
- Mock provider only
- No Resend network implementation
- No API key usage
- No network calls
- No production sending
- No mark-as-sent automation

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator (no live execution)
- `npm run verify-resend-provider-plan` — Resend plan documentation; skeleton-only provider module

**Release candidate:** **v6.0.0-alpha.4**

### Phase 18 constraints

- Documentation and version display only — no app behaviour changes
- No Resend network implementation, API key usage, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 19 — Resend network implementation

**Scope:** Implement `createResendEmailProvider` network adapter in isolation. **Provider module only** — no `app.js` wiring, no send button, no mark-as-sent automation, no compliance/action/history mutation, no automatic delivery execution.

**Target module:** `js/app/automation/providers/resend-provider.js`

**Verification:** `scripts/verify-resend-provider.mjs` — `npm run verify-resend-provider`

### Factory contract

```javascript
createResendEmailProvider({ config, fetchImpl })
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `config` | Yes (for sends) | Provider configuration including secrets (`apiKey`) passed by worker at runtime — never from browser bundle |
| `fetchImpl` | At send time | Injected `fetch` implementation for `POST https://api.resend.com/emails` — **no global `fetch`** in module |

### Configuration validation

`healthCheck()` and `sendReminder()` require explicit config when enabled:

| Field | Rule |
|-------|------|
| `config.enabled` | Must be `true` |
| `config.provider` | Must be `"resend"` |
| `config.mode` | Must be `"test"` or `"production"` |
| `config.apiKey` | Non-empty string |
| `config.fromEmail` | Non-empty string |
| `config.testRedirectTo` | Required when `mode === "test"` |

| Validation result | `healthCheck()` | `sendReminder()` |
|-------------------|-----------------|------------------|
| `enabled !== true` | `{ status: "disabled", provider: "resend" }` | Throws `Resend email provider is disabled` |
| Enabled but invalid | `{ status: "invalid_config", provider: "resend" }` | Throws `Resend email provider configuration is invalid` |
| Valid | `{ status: "ok", provider: "resend", mode }` | Calls Resend API via `fetchImpl` |

`healthCheck()` does **not** call the network (Phase 19).

### Send behaviour

| Mode | Recipient | Subject |
|------|-----------|---------|
| `test` | `config.testRedirectTo` replaces `to` | Prefix `[TEST]` |
| `production` | Real `to` from input | Unchanged |

HTTP failures return structured results — never throw (config/validation failures still throw).

| HTTP status | `failureType` |
|-------------|---------------|
| `429`, `500`, `502`, `503`, `504` | `transient` |
| `400`, `401`, `403`, `404`, `422` | `permanent` |
| Other | `transient` |
| Network error | `transient` (`resend_network_error`) |

2xx responses return `{ status: "delivered", providerMessageId, deliveredAt }`.

### Phase 19 constraints

- Provider module and verification only
- Injected `fetchImpl` only — no global `fetch`
- Not imported in `app.js` or wired to delivery execution
- No send button, mark-as-sent automation, or compliance/action/history mutation
- No live API calls in CI (`verify-resend-provider` uses mocked `fetchImpl`)

### Phase 19 verification

`npm run verify-resend-provider` checks:

1. Valid config `healthCheck()` returns `ok` / `resend`
2. Invalid/disabled config blocks `sendReminder()`
3. Test mode redirects recipient and prefixes subject
4. Production mode uses real recipient
5. 2xx → `delivered`; transient/permanent status mapping
6. No global `fetch(` in provider source
7. `app.js` not wired; no mark-sent/compliance/action/history hooks

---

## Phase 20 — Resend provider foundation verification orchestrator

**Scope:** One verification command proving provider skeleton foundation, Resend plan documentation, and isolated Resend implementation all remain safe — still not wired into app execution. **Verification only** — no app behaviour changes.

**Script:** `scripts/verify-resend-provider-foundation.mjs`

`npm run verify-resend-provider-foundation` runs verification scripts in order:

1. `verify-email-provider-skeleton-foundation` (phases 12 + 14–15 orchestrator)
2. `verify-resend-provider-plan` (phase 17 Resend plan documentation)
3. `verify-resend-provider` (phase 19 Resend provider network implementation)

Stops on first failure. Prints section headings for each step. Final success message: `V6 Resend provider foundation verification: OK`

### Phase 20 constraints

- Verification orchestration only
- No `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 21 — Resend provider release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.5`), and release-readiness gate for the isolated Resend provider slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.5):**

- V6 Phases 1–21 complete
- Isolated Resend provider complete (`createResendEmailProvider` with injected `fetchImpl` only)
- Resend provider foundation verification orchestrator complete (`npm run verify-resend-provider-foundation`)
- Disabled-by-default provider mode
- No `app.js` wiring
- No UI send button
- No automatic delivery execution
- No mark-as-sent automation
- No compliance/action/history mutation

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — skeleton foundation + Resend plan + Resend provider orchestrator (no live execution)

**Release candidate:** **v6.0.0-alpha.5**

### Phase 21 constraints

- Documentation and version display only — no app behaviour changes
- No `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 22 — Delivery Operations Log UI + export

**Scope:** Read-only **Delivery Operations Log** UI loading `get_reminder_delivery_logs` via cloud automation store. Summary counts, expandable detail panel, CSV export. **No send button, delivery execution, or mark-as-sent automation.**

**Verification:** `npm run verify-delivery-operations-log-ui`

### Phase 22 constraints

- Read-only audit UI — loads existing delivery log rows only
- No send/retry/execute/mark-sent controls
- No `sendReminder` or provider network calls from `app.js`

---

## Phase 23 — Delivery Operations Log release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.6`), and release-readiness gate for the read-only Delivery Operations Log slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.6):**

- V6 Phases 1–23 complete
- Delivery Operations Log UI complete (read-only audit view, CSV export)
- **No send/retry/execute controls**
- **No mark-as-sent automation**
- **No automatic delivery execution**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — Resend provider foundation still safe
- `npm run verify-delivery-operations-log-ui` — read-only audit UI and CSV export; no execution hooks

**Release candidate:** **v6.0.0-alpha.6**

### Phase 23 constraints

- Documentation and version display only — no app behaviour changes
- No send/retry/execute controls, mark-as-sent automation, or automatic delivery execution
