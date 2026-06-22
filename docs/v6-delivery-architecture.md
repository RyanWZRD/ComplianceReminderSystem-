# v6.0.0 — Delivery Domain Model

**Theme:** Define how reminder emails would be sent and audited — lifecycle, records, duplicate prevention, retries, and provider abstraction — **without** implementing delivery.

**Target:** v6.0.0 (major release)  
**Current phase:** V6.1 Phase 1 — Beta Validation  
**Release candidate:** v6.0.0-beta.1 (baseline for beta validation)  
**Prerequisites:** v5.0.0-alpha.5 (V5-2 template & digest foundation)  
**Date:** Planned — June 2026+

---

## Executive summary

V5 established reminder **preparation**: dry-run scan, in-memory queue, template builder, digest builder, and preview UI. Safeguarding officers can see *what would be sent* but the system does not yet model *how sending would work* or *how outcomes would be audited*.

**v6.0.0 Phase 1** introduces the **delivery domain model**: a documented contract for reminder delivery lifecycle, per-recipient records, audit requirements, duplicate prevention, retry strategy, and a future email-provider abstraction. No email provider, no outbound delivery, no mark-as-sent automation, and no new runtime code paths in this phase.

| V5 (today) | V6 Phase 1 (architecture) | V6 Phase 2 (record builder) | V6 Phase 3 (schema) | V6 Phase 4 (RPC draft) | V6 Phase 5 (state machine) | V6 Phase 6 (mock provider) | V6 Phase 7 (mock executor) | V6+ (future) |
|------------|----------------------------|-----------------------------|---------------------|------------------------|------------------------------|----------------------------|----------------------------|--------------|
| Queue items with `status: "queued"` | Delivery lifecycle states documented | In-memory delivery records (`prepared` / `failed`) | `reminder_delivery_logs` Postgres schema + RLS | `create_reminder_delivery_log` / `get_reminder_delivery_logs` RPCs | `transitionReminderDeliveryRecord` in-memory transitions | `createMockEmailProvider` simulated sends | `executeMockReminderDelivery` in-memory lifecycle | Real provider integration |
| Template/digest preview only | Reminder delivery record shape + audit rules | `buildReminderDeliveryRecords` from queue + templates | Schema only — no app wiring | RPC draft — no app wiring | State machine — no provider or DB writes | Mock `sendReminder()` / `healthCheck()` — no real sends | Mock execution only — no production delivery | Delivery worker + real provider |
| `delivery_log` table planned in V5-0C | Formal delivery record contract | Record builder — no DB writes | Migration + dedup index — no writes from app | Admin create + admin/editor read RPCs | Lifecycle transitions + `statusHistory` audit | Provider adapter — no execution | State machine + mock provider orchestration | |
| No duplicate-send rules | Duplicate-prevention key defined | Missing-email → `failed` with `missing_recipient_email` | Partial unique index on dedup dimensions | Controlled insert/read only — no send | Validated transitions, terminal states | Simulated provider outcomes | Skips terminal/missing-email records | Enforced at queue + delivery layers |

**Non-goals for Phase 1:** Resend/SMTP integration, Edge Functions, migrations, RPCs, UI changes, mark-as-sent automation, or compliance/action/history mutation.

---

## Position in the stack

```
┌─────────────────────────────────────────────────────────────────┐
│  V5 — Preparation (shipped in alpha)                             │
│  dry-run → reminder queue → template/digest builder → preview UI │
└────────────────────────────┬────────────────────────────────────┘
                             │ queue items + templates (input)
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 1 — Delivery domain model (this document)              │
│  lifecycle · delivery record · audit · dedup · retry · provider  │
└────────────────────────────┬────────────────────────────────────┘
                             │ contract for future implementation
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 2 — Delivery record builder (shipped in this slice)     │
│  buildReminderDeliveryRecords · template attach · prepared/failed │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-memory records (no provider)
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 3 — Delivery log schema (shipped)                      │
│  reminder_delivery_logs table · RLS · dedup index · no RPCs      │
└────────────────────────────┬────────────────────────────────────┘
                             │ schema ready for controlled RPCs
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 4 — Delivery log RPC draft                             │
│  create_reminder_delivery_log · get_reminder_delivery_logs         │
└────────────────────────────┬────────────────────────────────────┘
                             │ RPCs ready for future worker/store
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 5 — Delivery state machine (shipped in this slice)     │
│  transitionReminderDeliveryRecord · statusHistory · timestamps     │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-memory transitions (no provider)
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 6 — Mock email provider (shipped)                      │
│  createMockEmailProvider · success / transient / permanent modes │
└────────────────────────────┬────────────────────────────────────┘
                             │ simulated provider (no real sends)
┌────────────────────────────▼────────────────────────────────────┐
│  V6 Phase 7 — Mock delivery executor (shipped in this slice)   │
│  executeMockReminderDelivery · prepared → sending → outcome      │
└────────────────────────────┬────────────────────────────────────┘
                             │ in-memory mock execution only
┌────────────────────────────▼────────────────────────────────────┐
│  V6+ — Delivery implementation (future)                        │
│  process_notification_queue · real EmailProvider · worker wiring   │
└─────────────────────────────────────────────────────────────────┘
```

**Principles (carry forward from v3/v4/v5):**

- All automated **writes** continue through RPC — delivery records are server-owned
- Delivery respects **org scope** and role permissions (view logs; admin configures)
- Every delivery attempt produces an **immutable audit trail** — no silent failures
- Local mode: delivery **disabled** with clear UI messaging (cloud-only feature)
- V5 queue items remain the **source candidates**; delivery records track per-recipient outcomes

---

## Delivery lifecycle

Each reminder delivery progresses through exactly one terminal state (`delivered`, `failed`, or `cancelled`). Intermediate states are observable for operations and audit.

| State | Meaning | Typical trigger |
|-------|---------|-----------------|
| `queued` | Delivery record created; awaiting preparation | Queue processor picks a queue item with a valid recipient |
| `prepared` | Subject, body, and recipient resolved; ready for provider handoff | Template builder output attached to delivery record |
| `sending` | Provider `sendReminder()` in flight | Worker invokes email provider |
| `delivered` | Provider accepted and confirmed delivery (or accepted for delivery per provider contract) | Provider success response + optional webhook |
| `failed` | Delivery attempt ended without success | Provider error, validation failure, or retry budget exhausted |
| `cancelled` | Delivery intentionally aborted before success | Admin cancel, duplicate detected, or queue item superseded |

### State transitions

```
                    ┌─────────────┐
                    │   queued    │
                    └──────┬──────┘
                           │ prepare template + recipient
                           ▼
                    ┌─────────────┐
         ┌─────────│  prepared   │─────────┐
         │         └──────┬──────┘         │
         │ cancel           │ send           │ cancel
         ▼                  ▼                ▼
  ┌─────────────┐    ┌─────────────┐  ┌─────────────┐
  │  cancelled  │    │   sending   │  │  cancelled  │
  └─────────────┘    └──────┬──────┘  └─────────────┘
                            │
              ┌─────────────┼─────────────┐
              │ success     │ transient   │ permanent
              ▼             │ failure     │ failure
       ┌─────────────┐      │             ▼
       │  delivered  │      │      ┌─────────────┐
       └─────────────┘      │      │   failed    │
                             │      └─────────────┘
                             └──► retry (re-enter sending) or failed
```

**Rules:**

- `deliveryStatus` is the single source of truth for lifecycle position
- Timestamp fields (`preparedAt`, `sentAt`, `deliveredAt`, `failedAt`) are set when entering the corresponding state (or on first transition to that outcome)
- A record in `delivered`, `failed`, or `cancelled` is **terminal** — no in-place mutation of outcome; corrections require a new delivery record with audit linkage
- Transitions must be logged (see Audit requirements)

---

## Reminder delivery record

A **reminder delivery record** is the per-recipient audit unit. One queue item may produce one or more delivery records (e.g. person email and manager digest), but each record tracks a single outbound attempt chain.

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` (UUID) | Unique delivery record identifier |
| `organisationId` | `string` (UUID) | Owning organisation |
| `automationRunId` | `string` (UUID) | Automation run that produced or processed this delivery |
| `queueItemId` | `string` | Stable id linking back to the reminder queue item (V5 queue) |
| `recipientEmail` | `string` | Normalised recipient address at time of preparation |
| `subject` | `string` | Email subject line used for this attempt |
| `deliveryStatus` | `DeliveryStatus` | Current lifecycle state (see below) |
| `preparedAt` | `string \| null` (ISO 8601) | When record entered `prepared` |
| `sentAt` | `string \| null` (ISO 8601) | When provider handoff began (`sending`) |
| `deliveredAt` | `string \| null` (ISO 8601) | When terminal success confirmed |
| `failedAt` | `string \| null` (ISO 8601) | When terminal failure recorded |
| `failureReason` | `string \| null` | Human-readable failure detail when `failed` |

### `DeliveryStatus` enum

```typescript
type DeliveryStatus =
  | "queued"
  | "prepared"
  | "sending"
  | "delivered"
  | "failed"
  | "cancelled";
```

### Example record (illustrative)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "organisationId": "org-uuid",
  "automationRunId": "run-uuid",
  "queueItemId": "queue-item-stable-id",
  "recipientEmail": "safeguarding@example.org",
  "subject": "DBS reminder: Jane Smith — expires 2026-07-15",
  "deliveryStatus": "delivered",
  "preparedAt": "2026-06-18T08:00:00.000Z",
  "sentAt": "2026-06-18T08:00:05.000Z",
  "deliveredAt": "2026-06-18T08:00:12.000Z",
  "failedAt": null,
  "failureReason": null
}
```

### Future optional fields (out of Phase 1 scope)

These may appear in later phases but are **not** required for the Phase 1 contract:

- `complianceRecordId` — denormalised link for duplicate prevention queries
- `reminderWindow` — e.g. `30-day`, `14-day`, `7-day`, `expired`
- `retryCount`, `lastRetryAt`, `providerMessageId`
- `cancelledAt`, `cancellationReason`

Phase 1 implementations may store these in related audit/event tables without changing the core shape above.

---

## Audit requirements

Delivery is a safeguarding-sensitive operation. Phase 1 defines audit rules that **must** be satisfied by any future implementation.

| Requirement | Rule |
|-------------|------|
| **Every attempted delivery logged** | Creating a delivery record (or append-only delivery event) is mandatory before calling a provider. No fire-and-forget sends. |
| **Delivery outcome retained** | Terminal state (`delivered`, `failed`, `cancelled`) and timestamps are persisted immutably. Outcomes are not deleted on success. |
| **Retries recorded** | Each retry attempt is auditable: either a new delivery record linked to the same `queueItemId`, or an append-only `delivery_events` stream with `eventType: "retry"`, attempt number, and error detail. |
| **No silent failures** | Provider errors, validation failures, and retry exhaustion must set `deliveryStatus: "failed"` with `failureReason` and `failedAt`. Background workers must not swallow exceptions without a persisted failure record. |

### Audit event types (future implementation)

| Event | When |
|-------|------|
| `delivery.created` | Record inserted in `queued` |
| `delivery.prepared` | Template attached; `preparedAt` set |
| `delivery.sending` | Provider call started; `sentAt` set |
| `delivery.delivered` | Success; `deliveredAt` set |
| `delivery.failed` | Failure; `failedAt` and `failureReason` set |
| `delivery.cancelled` | Aborted before delivery |
| `delivery.retry` | Retry scheduled or executed |

Operations Log UI (V5-0 audit UI pattern) will eventually surface delivery records alongside automation runs.

---

## Duplicate-prevention rules

The same person must not receive duplicate reminder emails for the same compliance context on the same day.

### Dedup key

A **dedup key** uniquely identifies one logical send slot:

```
dedupKey = hash(
  organisationId,
  complianceRecordId,
  reminderWindow,   // e.g. "30-day", "14-day", "7-day", "expired"
  calendarDay       // org timezone, YYYY-MM-DD
)
```

| Dimension | Rule |
|-----------|------|
| **Same reminder window** | One delivery per window per record per day (30-day and 14-day are distinct windows) |
| **Same compliance record** | Scoped to a single compliance row (person + compliance type + expiry context) |
| **Same day** | Calendar day in organisation timezone (`Europe/London` default from V5 policy schema) |

### Enforcement behaviour (future)

1. Before creating a delivery record in `queued`, check for an existing record with the same dedup key in a non-failed terminal state (`delivered`) or in-flight state (`queued`, `prepared`, `sending`) for that day.
2. If a prior `delivered` exists for the dedup key today → **skip** (do not enqueue duplicate).
3. If a prior `failed` exists → allow **retry** subject to retry strategy (new record or retry event, not a silent resend).
4. If duplicate detected at preparation time → set `deliveryStatus: "cancelled"` with reason `duplicate_prevented` and audit log entry.

**Phase 1:** rules documented only; no runtime enforcement.

---

## Retry strategy

Failures are classified so operators know whether to expect automatic retry or manual intervention.

### Failure classification

| Class | Examples | Action |
|-------|----------|--------|
| **Transient failure** | HTTP 429/5xx, provider timeout, temporary DNS failure | Automatic retry with backoff |
| **Permanent failure** | Invalid recipient, auth failure (401/403), policy block, malformed template, unknown domain | No retry; `failed` immediately with clear `failureReason` |

### Retry limits

| Setting | Default | Notes |
|---------|---------|-------|
| `maxAttempts` | `3` | Initial attempt + 2 retries for transient failures |
| `initialBackoffMs` | `60_000` | 1 minute |
| `maxBackoffMs` | `900_000` | 15 minutes cap |
| `backoffMultiplier` | `2` | Exponential backoff between transient retries |

After `maxAttempts` exhausted:

- Set `deliveryStatus: "failed"`
- Set `failureReason` to include last provider error and attempt count
- Emit audit event `delivery.failed` with `retryExhausted: true`
- Surface in Operations Log for admin review

**Phase 1:** strategy documented only; no retry worker.

---

## Future provider abstraction

Email sending is intentionally behind an interface so providers (Resend, SMTP, etc.) can be swapped without changing queue or audit logic.

### `EmailProvider` interface

```typescript
interface EmailProvider {
  /**
   * Send a single reminder email.
   * Must not mutate compliance data or mark reminders sent — delivery layer only.
   */
  sendReminder(input: SendReminderInput): Promise<SendReminderResult>;

  /**
   * Lightweight health check for cron/worker startup (credentials, API reachability).
   */
  healthCheck(): Promise<HealthCheckResult>;
}

interface SendReminderInput {
  deliveryId: string;
  organisationId: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  metadata?: Record<string, string>;
}

interface SendReminderResult {
  success: boolean;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  transient?: boolean;
}

interface HealthCheckResult {
  ok: boolean;
  provider: string;
  latencyMs?: number;
  errorMessage?: string;
}
```

### Provider responsibilities

- Accept normalised `SendReminderInput` from the delivery worker
- Return structured success/failure with `transient` hint for retry logic
- Never access Postgres directly — worker owns record state transitions
- Secrets (API keys) live in Edge Function / worker environment only

### Worker flow (future)

1. Load delivery record in `prepared`
2. Transition to `sending`; set `sentAt`
3. Call `emailProvider.sendReminder(...)`
4. On success → `delivered`, set `deliveredAt`
5. On transient failure → schedule retry or `failed` if budget exhausted
6. On permanent failure → `failed` immediately

**Phase 1:** interface specified only; no provider module or secrets.

---

## Security considerations (future implementation)

| Area | Requirement |
|------|-------------|
| **API keys** | Stored in Supabase Edge Function secrets or worker env — never in client bundle, `localStorage`, or repo |
| **Audit trails** | Delivery records append-only; admin access via RPC with org membership checks; export includes delivery log in V5-4 operations pack |
| **Rate limiting** | Per-org send rate caps to prevent abuse and provider quota exhaustion; batch queue processing |
| **GDPR considerations** | `recipientEmail` is personal data — retention policy aligned with V5-4D delivery log retention; right-to-erasure must anonymise or purge delivery PII while retaining aggregate audit metadata where legally required |

---

## Relationship to V5 artefacts

| V5 artefact | V6 delivery model usage |
|-------------|-------------------------|
| `buildReminderQueueFromDryRun` | Produces queue items → source for `queueItemId` |
| `buildReminderEmailTemplate` | Produces `subject` + `bodyText` for `prepared` state |
| `buildReminderDeliveryRecords` | Produces in-memory delivery records from queue items + templates |
| `buildReminderDigest` | Separate delivery records for digest recipients |
| `automationRunId` | Links delivery batch to dry-run / live run |
| `reminder_delivery_logs` table (V6 Phase 3) | Physical store for reminder delivery records |

---

## Verification

| Command | Scope |
|---------|-------|
| `npm run verify-delivery-architecture` | Phase 1 — architecture document, lifecycle states, record fields, provider abstraction section |
| `npm run verify-reminder-delivery-record-builder` | Phase 2 — in-memory delivery record builder from queue fixtures |
| `npm run verify-reminder-delivery-log-schema` | Phase 3 — `reminder_delivery_logs` migration, columns, constraints, RLS, no app wiring |
| `npm run verify-reminder-delivery-log-rpcs` | Phase 4 — delivery log create/read RPC migration, role gates, no app wiring |
| `npm run verify-reminder-delivery-state-machine` | Phase 5 — in-memory delivery state transitions, timestamps, terminal states |
| `npm run verify-mock-email-provider` | Phase 6 — mock provider adapter, success/failure modes, no external network |
| `npm run verify-mock-delivery-executor` | Phase 7 — mock delivery executor, lifecycle transitions, skip rules, summary counts |
| `npm run verify-delivery-foundation` | Phase 8 — orchestrator; runs phases 1–7 in order, stop on first failure |
| `npm run verify-email-provider-config` | Phase 10 — provider config documentation, config module, safe defaults, no app wiring |
| `npm run verify-email-provider-adapter` | Phase 11 — adapter factory, disabled/mock/placeholder behaviour, no app wiring |
| `npm run verify-email-provider-foundation` | Phase 12 — orchestrator; runs phases 10–11 + delivery foundation in order, stop on first failure |
| `npm run verify-email-provider-skeletons` | Phase 14 — skeleton provider modules, adapter routing, no network/SDK hooks, no app wiring |
| `npm run verify-email-provider-skeleton-foundation` | Phase 15 — orchestrator; runs phases 12 + 14 in order, stop on first failure |
| `npm run verify-resend-provider-plan` | Phase 17 — Resend implementation plan documentation |
| `npm run verify-resend-provider` | Phase 19 — Resend provider network implementation (mocked `fetchImpl`; no app wiring) |
| `npm run verify-resend-provider-foundation` | Phase 54 — Edge shared email provider foundation (disabled by default; no live sends) |
| `npm run verify-email-provider-disabled-staging` | Phase 55 — staging verification that provider is disabled by default (no live sends) |
| `npm run verify-browser-resend-provider-foundation` | Phase 20 — browser orchestrator; runs skeleton foundation + Resend plan + Resend provider in order, stop on first failure |
| `npm run verify-delivery-operations-log-ui` | Phase 22 — Delivery Operations Log UI, CSV export, no execution hooks |
| `npm run verify-delivery-worker` | Phase 24 — worker delivery execution engine (in-memory; no app wiring) |
| `npm run verify-delivery-worker-persistence` | Phase 25 — worker persistence adapter (RPC payload mapping; no RPC calls) |
| `npm run verify-delivery-log-persistence-service` | Phase 26 — delivery log persistence service (RPC orchestration; no app wiring) |
| `npm run verify-delivery-pipeline-service` | Phase 27 — delivery pipeline service (execution + persistence composition; no app wiring) |
| `npm run verify-delivery-pipeline-foundation` | Phase 28 — delivery pipeline foundation orchestrator (full service-level stack) |
| `npm run verify-manual-delivery-runner` | Phase 30 — manual delivery pipeline runner (queue → pipeline; no scheduler/app wiring) |
| `npm run verify-manual-delivery-foundation` | Phase 31 — manual delivery foundation orchestrator (pipeline + manual runner stack) |
| `npm run verify-manual-delivery-ui` | Phase 33 — admin manual delivery test UI (confirmation + manual runner wiring) |
| `npm run verify-manual-delivery-e2e-foundation` | Phase 34 — manual delivery E2E foundation orchestrator (UI + provider + pipeline + ops log) |
| `npm run verify-beta-validation-checklist` | V6.1 Phase 1 — beta validation checklist completeness + automated test-area scripts |
| `npm run verify-edge-delivery-plan` | Phase 36 — server-side delivery architecture plan, CORS/secret safety |
| `npm run verify-edge-delivery-function-skeleton` | Phase 37 — Edge Function skeleton, validation, CORS, no delivery logs |
| `npm run verify-edge-delivery-resend` | Phase 38 — server-side Resend sends, test/production gates, failure mapping, no browser wiring |

**Phase 1 gate:** `npm run verify-delivery-architecture` must pass. No Supabase or browser required.

**Phase 2 gate:** `npm run verify-reminder-delivery-record-builder` must pass. No Supabase, browser, email provider, or database writes.

**Phase 3 gate:** `npm run verify-reminder-delivery-log-schema` must pass. Static migration checks only — no Supabase smoke, browser, email provider, or app wiring.

**Phase 4 gate:** `npm run verify-reminder-delivery-log-rpcs` must pass. Static migration checks only — no Supabase smoke, browser, email provider, or app wiring.

**Phase 5 gate:** `npm run verify-reminder-delivery-state-machine` must pass. No Supabase, browser, email provider, or database writes.

**Phase 6 gate:** `npm run verify-mock-email-provider` must pass. No Supabase, browser, real email provider, or database writes.

**Phase 7 gate:** `npm run verify-mock-delivery-executor` must pass. No Supabase, browser, real email provider, production delivery, or database writes.

**Phase 8 gate:** `npm run verify-delivery-foundation` must pass. Orchestrates phases 1–7 verification scripts in order. Verification-only — no real email provider, production delivery, mark-as-sent automation, or compliance/action/history mutation.

**Phase 9 gate:** `npm run build` and `npm run verify-delivery-foundation` must pass. Documentation and version bump only — no application logic changes. Mock provider only — no real email provider, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Phase 10 gate:** `npm run verify-email-provider-config` must pass. Configuration/design only — no real provider implementation, outbound delivery, mark-as-sent automation, or `app.js` wiring.

**Phase 11 gate:** `npm run verify-email-provider-adapter` must pass. Interface/factory only — no real provider implementation, network calls, outbound delivery, mark-as-sent automation, or `app.js` wiring.

**Phase 12 gate:** `npm run verify-email-provider-foundation` must pass. Verification orchestration only — no real provider implementation, network calls, production sending, mark-as-sent automation, or app behaviour changes.

**Phase 13 gate:** `npm run build` and `npm run verify-email-provider-foundation` must pass. Documentation and version bump only — no application logic changes. Mock provider only — no real provider implementation, production sending, mark-as-sent automation, or compliance/action/history mutation.

**Phase 17 gate:** `npm run verify-resend-provider-plan` must pass. Planning documentation only — no real provider implementation, `fetch`, SDK, SMTP, production sending, or `app.js` wiring.

**Phase 18 gate:** `npm run build`, `npm run verify-email-provider-skeleton-foundation`, and `npm run verify-resend-provider-plan` must pass. Documentation and version bump only — no application logic changes. Resend plan complete; no network implementation, API key usage, production sending, or mark-as-sent automation.

**Phase 19 gate:** `npm run verify-resend-provider` must pass. Resend provider module only — injected `fetchImpl`, no global `fetch`, no `app.js` wiring, no production automation path, no mark-as-sent automation.

**Phase 20 gate:** `npm run verify-resend-provider-foundation` must pass. Verification orchestration only — no app behaviour changes, `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation.

**Phase 21 gate:** `npm run build` and `npm run verify-resend-provider-foundation` must pass. Documentation and version bump only — no application logic changes. Isolated Resend provider complete; no `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation.

**Phase 22 gate:** `npm run verify-delivery-operations-log-ui` must pass. Read-only audit UI and CSV export only — no send button, delivery execution, mark-as-sent automation, or provider `sendReminder` calls.

**Phase 23 gate:** `npm run build`, `npm run verify-resend-provider-foundation`, and `npm run verify-delivery-operations-log-ui` must pass. Documentation and version bump only — no application logic changes. Delivery Operations Log UI complete; no send/retry/execute controls, mark-as-sent automation, or automatic delivery execution.

**Phase 24 gate:** `npm run verify-delivery-worker` must pass. Execution engine only — no `app.js` wiring, UI buttons, automatic scheduling, database writes, RPC calls, or mark-as-sent automation.

**Phase 25 gate:** `npm run verify-delivery-worker-persistence` must pass. Persistence mapping only — no provider calls, RPC execution, database writes, `app.js` wiring, or mark-as-sent automation.

**Phase 26 gate:** `npm run verify-delivery-log-persistence-service` must pass. Persistence service only — no provider calls, sending, `app.js` wiring, UI controls, or mark-as-sent automation.

**Phase 27 gate:** `npm run verify-delivery-pipeline-service` must pass. Service composition only — no `app.js` wiring, UI controls, scheduled jobs, or mark-as-sent automation.

**Phase 28 gate:** `npm run verify-delivery-pipeline-foundation` must pass. Verification orchestrator only — no app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Phase 29 gate:** `npm run build` and `npm run verify-delivery-pipeline-foundation` must pass. Documentation and version bump only — no application logic changes. Delivery pipeline stack complete at service level.

**Phase 30 gate:** `npm run verify-manual-delivery-runner` must pass. Manual runner service only — no scheduler, automatic delivery, `app.js` wiring, or mark-as-sent automation.

**Phase 31 gate:** `npm run verify-manual-delivery-foundation` must pass. Verification orchestrator only — no app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Phase 32 gate:** `npm run build` and `npm run verify-manual-delivery-foundation` must pass. Documentation and version bump only — no application logic changes.

**Phase 33 gate:** `npm run verify-manual-delivery-ui` must pass. Admin-only manual delivery test UI — no scheduling, automatic execution, or mark-as-sent automation.

**Phase 34 gate:** `npm run verify-manual-delivery-e2e-foundation` must pass. E2E foundation orchestrator only — no scheduled execution, automatic execution, mark-as-sent automation, or compliance/history mutation.

**Phase 35 gate:** `npm run build` and `npm run verify-manual-delivery-e2e-foundation` must pass. Documentation and version bump only — no mark-as-sent automation yet.

**V6.1 Phase 1 gate:** `npm run verify-beta-validation-checklist` must pass. Checklist documentation and automated validation only — no new features, schema changes, RPC changes, or UI changes unless a bug is found.

**Phase 36 gate:** `npm run verify-edge-delivery-plan` must pass. Planning documentation — architecture and safety rules documented.

**Phase 37 gate:** `npm run verify-edge-delivery-function-skeleton` must pass. Edge Function skeleton — POST/OPTIONS handlers, field validation, no delivery log writes.

**Phase 38 gate:** `npm run verify-edge-delivery-resend` must pass. Server-side Resend integration only — no delivery log writes, browser invoke wiring, mark-as-sent automation, or schema/RPC changes.

---

## Phase 2 — Delivery record builder

**Module:** `js/app/automation/reminder-delivery-record-builder.js`

**Function:** `buildReminderDeliveryRecords({ queueItems, organisationId, automationRunId, organisationName, asOfDate })`

For each reminder queue item, the builder:

1. Calls `buildReminderEmailTemplate()` for `subject` and `bodyText`
2. Creates an in-memory delivery record with lifecycle fields
3. Sets `deliveryStatus: "prepared"` when a recipient email is present
4. Sets `deliveryStatus: "failed"` with `failureReason: "missing_recipient_email"` when email is missing — record is still created with template content

### Record output shape

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` (UUID) | Unique delivery record identifier |
| `organisationId` | `string` (UUID) | Owning organisation |
| `automationRunId` | `string` (UUID) | Automation run that produced this delivery |
| `queueItemId` | `string` | Stable id derived from queue item fields |
| `recipientEmail` | `string \| null` | Normalised recipient; `null` when missing |
| `subject` | `string` | From template builder |
| `bodyText` | `string` | From template builder |
| `deliveryStatus` | `DeliveryStatus` | `"prepared"` or `"failed"` (missing email) in Phase 2 |
| `preparedAt` | `string \| null` (ISO 8601) | Set when `prepared`; `null` when failed at preparation |
| `sentAt` | `string \| null` | Always `null` in Phase 2 |
| `deliveredAt` | `string \| null` | Always `null` in Phase 2 |
| `failedAt` | `string \| null` (ISO 8601) | Set when `failed` (missing email) |
| `failureReason` | `string \| null` | `"missing_recipient_email"` when email missing |
| `metadata` | `object` | `reminderWindow`, `complianceType`, `expiryDate`, `source`, `emailMissing` |

### Phase 2 constraints

- Record preparation only — no email provider, no outbound delivery, no mark-as-sent automation
- No database writes
- Input `queueItems` array is not mutated
- Missing-email queue items still produce a record (with template subject/body) but `deliveryStatus: "failed"`

---

## Phase 3 — Delivery log schema

**Migration:** `supabase/migrations/20260401000006_create_reminder_delivery_logs.sql`

**Table:** `public.reminder_delivery_logs`

Stores per-recipient reminder delivery audit records. Schema only in this phase — no RPCs, no app store wiring, no provider integration, and no mark-as-sent automation.

### Columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | Primary key (`gen_random_uuid()`) |
| `organisation_id` | `uuid` | Owning organisation (FK → `organisations`) |
| `automation_run_id` | `uuid` | Optional link to `automation_runs` |
| `queue_item_id` | `text` | Stable V5 queue item id |
| `compliance_record_id` | `uuid` | Optional FK for dedup queries |
| `person_id` | `uuid` | Optional FK to `people` |
| `recipient_email` | `text` | Normalised recipient at preparation time |
| `subject` | `text` | Email subject |
| `body_text` | `text` | Plain-text body |
| `delivery_status` | `text` | Lifecycle state (see constraint below) |
| `prepared_at` | `timestamptz` | When record entered `prepared` |
| `sent_at` | `timestamptz` | When provider handoff began |
| `delivered_at` | `timestamptz` | Terminal success timestamp |
| `failed_at` | `timestamptz` | Terminal failure timestamp |
| `failure_reason` | `text` | Human-readable failure detail |
| `metadata` | `jsonb` | Context such as `reminderWindow` (default `{}`) |
| `created_by` | `uuid` | Optional FK to `profiles` |
| `created_at` | `timestamptz` | Row creation time |
| `updated_at` | `timestamptz` | Maintained by `set_updated_at()` trigger |

### Constraints

- **`delivery_status` check:** `queued`, `prepared`, `sending`, `delivered`, `failed`, `cancelled`
- **Dedup unique index** (`reminder_delivery_logs_dedup_idx`): `(organisation_id, compliance_record_id, metadata->>'reminderWindow', prepared_at::date)` where `compliance_record_id is not null`

### Row-level security

| Operation | Roles |
|-----------|-------|
| `SELECT` | `admin`, `editor` |
| `INSERT` | `admin` |
| `UPDATE` | `admin` |
| `DELETE` | Not yet defined |

### Phase 3 constraints

- Schema and migration only — no email provider, no outbound delivery, no mark-as-sent automation
- No RPCs, no cloud store methods, no UI changes
- `updated_at` maintained via shared `public.set_updated_at()` trigger

---

## Phase 4 — Delivery log RPC draft

**Migration:** `supabase/migrations/20260401000007_reminder_delivery_log_rpcs.sql`

Controlled Postgres RPCs for inserting and reading reminder delivery logs. RPC draft only — no cloud store wiring, no UI, no email provider, and no mark-as-sent automation.

### `public.create_reminder_delivery_log(...)`

**Roles:** `admin` only (internal role check; `authenticated` grant with invoker security).

**Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| `p_organisation_id` | `uuid` | Must match caller's current organisation |
| `p_queue_item_id` | `text` | Required — stable V5 queue item id |
| `p_subject` | `text` | Required |
| `p_body_text` | `text` | Required |
| `p_delivery_status` | `text` | Required — one of lifecycle states |
| `p_automation_run_id` | `uuid` | Optional — must belong to org when set |
| `p_compliance_record_id` | `uuid` | Optional — must belong to org when set |
| `p_person_id` | `uuid` | Optional — must belong to org when set |
| `p_recipient_email` | `text` | Optional |
| `p_prepared_at` | `timestamptz` | Optional |
| `p_sent_at` | `timestamptz` | Optional |
| `p_delivered_at` | `timestamptz` | Optional |
| `p_failed_at` | `timestamptz` | Optional |
| `p_failure_reason` | `text` | Optional |
| `p_metadata` | `jsonb` | Default `{}` — must be a JSON object |

**Behaviour:** Validates `delivery_status` against `queued`, `prepared`, `sending`, `delivered`, `failed`, `cancelled`. Inserts one `reminder_delivery_logs` row with `created_by = auth.uid()`. Returns `{ id, delivery_status, created_at }`. No email sending; no compliance/action/history mutation.

### `public.get_reminder_delivery_logs(p_organisation_id uuid)`

**Roles:** `admin` and `editor` read; `viewer` denied via internal role check.

**Behaviour:** Returns `{ status: "ok", logs: [...] }` with org-scoped rows ordered by `created_at desc`. Read-only — no mutation.

### Phase 4 constraints

- Database RPC only — no email provider, no outbound delivery, no mark-as-sent automation
- No cloud store methods, no UI changes, no compliance/action/history mutation
- `GRANT EXECUTE` to `authenticated`; permissions enforced inside each function

---

## Phase 5 — Delivery state machine

**Module:** `js/app/automation/reminder-delivery-state-machine.js`

**Function:** `transitionReminderDeliveryRecord({ record, nextStatus, reason, at })`

Pure in-memory state transitions for reminder delivery records. Returns a new record object; does not mutate the input.

### Valid transitions

| From | To |
|------|-----|
| `queued` | `prepared`, `cancelled` |
| `prepared` | `sending`, `cancelled`, `failed` |
| `sending` | `delivered`, `failed` |
| `failed` | `queued`, `cancelled` |
| `delivered` | *(terminal — no further transitions)* |
| `cancelled` | *(terminal — no further transitions)* |

Invalid transitions throw a clear error.

### Timestamp and reason fields

| Target status | Fields set |
|---------------|------------|
| `prepared` | `preparedAt` if missing |
| `sending` | `sentAt` if missing |
| `delivered` | `deliveredAt` |
| `failed` | `failedAt`, `failureReason` |
| `cancelled` | `cancelledAt`, `cancellationReason` |

### Audit metadata

Each transition appends a `statusHistory` entry:

```json
{ "from": "prepared", "to": "sending", "at": "2026-06-18T10:05:00.000Z", "reason": null }
```

### Phase 5 constraints

- State logic only — no email provider, no outbound delivery, no mark-as-sent automation
- No database writes
- Input `record` is not mutated
- No app UI or cloud store wiring

---

## Phase 6 — Mock email provider

**Module:** `js/app/automation/mock-email-provider.js`

**Function:** `createMockEmailProvider({ mode })`

Simulated email provider adapter for testing delivery flow without real sends. Implements the provider surface (`sendReminder`, `healthCheck`) with configurable outcomes.

### Modes

| Mode | `sendReminder` result |
|------|----------------------|
| `success` (default) | `{ status: "delivered", providerMessageId, deliveredAt }` |
| `transient_failure` | `{ status: "failed", failureType: "transient", failureReason }` |
| `permanent_failure` | `{ status: "failed", failureType: "permanent", failureReason }` |

### `sendReminder` input

| Field | Type | Description |
|-------|------|-------------|
| `to` | `string` | Recipient email address |
| `subject` | `string` | Email subject line |
| `bodyText` | `string` | Plain-text body |
| `metadata` | `object` (optional) | Opaque context — not sent externally |

### `healthCheck` result

```json
{ "status": "ok", "provider": "mock" }
```

### Phase 6 constraints

- Mock provider only — no real email provider, no outbound delivery, no mark-as-sent automation
- Must not call `fetch`, SMTP, or external APIs
- Must not mutate compliance/action/history or mark reminders sent
- No database writes, no app UI or cloud store wiring

---

## Phase 7 — Mock delivery executor

**Module:** `js/app/automation/mock-delivery-executor.js`

**Function:** `executeMockReminderDelivery({ records, provider, at })`

In-memory delivery executor that processes prepared delivery records using a mock email provider only. Orchestrates state machine transitions and provider calls without real sends, production delivery, or persistence.

### Per-record behaviour

| Input state | Action |
|-------------|--------|
| `prepared` | Transition to `sending`, call `provider.sendReminder()`, then transition to `delivered` or `failed` based on provider result |
| `failed` with `failureReason: "missing_recipient_email"` | Skip — provider not called |
| `delivered` or `cancelled` | Skip — record unchanged |
| Other states (e.g. `queued`, `sending`) | Skip — record unchanged |

### Provider call input

Maps delivery record fields to the mock provider surface:

| Field | Source |
|-------|--------|
| `to` | `recipientEmail` |
| `subject` | `subject` |
| `bodyText` | `bodyText` |
| `metadata` | `metadata` |

### Return value

```json
{
  "records": [/* updated delivery records */],
  "summary": {
    "total": 4,
    "attempted": 1,
    "delivered": 1,
    "failed": 0,
    "skipped": 3
  }
}
```

| Summary field | Meaning |
|---------------|---------|
| `total` | Input record count |
| `attempted` | Records transitioned from `prepared` to `sending` |
| `delivered` | Records that ended `delivered` in this run |
| `failed` | Records that ended `failed` from provider outcome in this run |
| `skipped` | Records left unchanged (terminal, missing-email, or non-`prepared`) |

Uses `transitionReminderDeliveryRecord()` from the state machine for all status changes. Input `records` array and individual input records are not mutated.

### Phase 7 constraints

- Mock execution only — no real email provider, no production delivery, no mark-as-sent automation
- Must not call `fetch`, SMTP, or external APIs
- Must not mutate compliance/action/history or mark reminders sent
- No database writes, no app UI or cloud store wiring

---

## Phase 8 — Delivery foundation verification orchestrator

**Script:** `scripts/verify-delivery-foundation.mjs`

`npm run verify-delivery-foundation` runs phases 1–7 verification scripts in order:

1. `verify-delivery-architecture`
2. `verify-reminder-delivery-record-builder`
3. `verify-reminder-delivery-log-schema`
4. `verify-reminder-delivery-log-rpcs`
5. `verify-reminder-delivery-state-machine`
6. `verify-mock-email-provider`
7. `verify-mock-delivery-executor`

Stops on first failure. Prints section headings for each step. Verification-only — no real email provider, production delivery, mark-as-sent automation, or compliance/action/history mutation.

### Phase 8 constraints

- Orchestration only — no app behaviour changes
- No real email provider, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 9 — Delivery foundation release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.1`), and release-readiness gate for the delivery foundation slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.1):**

- Delivery domain model complete (lifecycle, record shape, audit, dedup, retry, `EmailProvider` interface)
- In-memory delivery record builder complete (`buildReminderDeliveryRecords`)
- `reminder_delivery_logs` schema + RLS complete
- Delivery log RPC draft complete (`create_reminder_delivery_log`, `get_reminder_delivery_logs`)
- In-process delivery state machine complete (`transitionReminderDeliveryRecord`)
- Mock email provider complete (`createMockEmailProvider`)
- Mock delivery executor complete (`executeMockReminderDelivery`)
- Delivery foundation verification orchestrator complete (`npm run verify-delivery-foundation`)
- **Mock provider only**
- **No real email provider**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-delivery-foundation` — phases 1–8 orchestrator (no live execution)

**Release candidate:** **v6.0.0-alpha.1**

### Phase 9 constraints

- Documentation and version display only — no app behaviour changes
- Mock provider only — no real email provider, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 10 — Provider configuration architecture

**Documentation:** `docs/v6-email-provider-configuration.md`

**Module:** `js/app/automation/email-provider-config.js`

**Function:** `getEmailProviderConfig(env?)`

Defines how a real email provider will be configured safely — supported future providers (Resend, SendGrid, SMTP), required environment variables, sender/reply-to rules, test vs production mode, rate limits, health checks, secret handling, audit requirements, and GDPR notes. Returns operational config shape only; API keys are not included in the return value.

### Return shape

| Field | Type | Default |
|-------|------|---------|
| `provider` | `string` | `"none"` |
| `mode` | `string` | `"disabled"` |
| `fromEmail` | `string \| null` | `null` |
| `replyToEmail` | `string \| null` | `null` |
| `rateLimitPerRun` | `number` | `50` |
| `enabled` | `boolean` | `false` |

### Phase 10 constraints

- Configuration/design only — no real provider implementation, no sending, no mark-as-sent automation
- Not imported in `app.js` or wired to delivery execution
- No `fetch`, SMTP, or external network calls in the config module
- No compliance/action/history mutation

---

## Phase 11 — Provider adapter interface

**Module:** `js/app/automation/email-provider-adapter.js`

**Function:** `createEmailProviderAdapter({ config, mockProvider })`

Factory that resolves email provider configuration into a provider surface (`healthCheck`, `sendReminder`). Composes Phase 10 config with Phase 6 mock provider and safe placeholders for unimplemented real providers.

### Resolution behaviour

| Condition | Result |
|-----------|--------|
| `config.enabled === false` | Disabled provider — `healthCheck()` → `{ status: "disabled", provider: "none" }`; `sendReminder()` throws `Email provider is disabled` |
| `config.provider === "mock"` (enabled) | Returns injected `mockProvider` or `createMockEmailProvider({ mode: "success" })` |
| `config.provider` ∈ `{ resend, sendgrid, smtp }` (enabled) | Skeleton provider module — `healthCheck()` → `{ status: "not_implemented", provider: <name> }`; `sendReminder()` throws `Provider <name> is not implemented yet` |

### Phase 11 constraints

- Interface/factory only — no real provider SDKs, no sending, no mark-as-sent automation
- Not imported in `app.js` or wired to delivery execution
- No `fetch`, SMTP, external SDKs, or network calls
- No compliance/action/history mutation

---

## Phase 12 — Provider foundation verification orchestrator

**Script:** `scripts/verify-email-provider-foundation.mjs`

`npm run verify-email-provider-foundation` runs provider and delivery foundation verification scripts in order:

1. `verify-email-provider-config`
2. `verify-email-provider-adapter`
3. `verify-delivery-foundation`

Stops on first failure. Prints section headings for each step. Verification-only — no real email provider, network calls, production sending, mark-as-sent automation, or app behaviour changes.

### Phase 12 constraints

- Orchestration only — no app behaviour changes
- No real email provider, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 13 — Provider foundation release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.2`), and release-readiness gate for the provider foundation slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.2):**

- V6 Phases 1–13 complete (delivery foundation phases 1–9 + provider foundation phases 10–13)
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider foundation verification orchestrator complete (`npm run verify-email-provider-foundation`)
- **Disabled-by-default provider mode** (`enabled: false`, `mode: disabled`, `provider: none`)
- **Mock provider only**
- **No real provider implementation**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-foundation` — phases 10–12 orchestrator (no live execution)

**Release candidate:** **v6.0.0-alpha.2**

### Phase 13 constraints

- Documentation and version display only — no app behaviour changes
- Mock provider only — no real provider implementation, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 14 — Real provider skeleton modules

**Scope:** Placeholder provider modules for future Resend, SendGrid, and SMTP integration. Skeleton behaviour only — no fetch, API keys, external SDKs, SMTP transport, real sending, mark-as-sent automation, or `app.js` wiring.

| Provider | Module | Factory |
|----------|--------|---------|
| Resend | `js/app/automation/providers/resend-provider.js` | `createResendEmailProvider({ config })` |
| SendGrid | `js/app/automation/providers/sendgrid-provider.js` | `createSendgridEmailProvider({ config })` |
| SMTP | `js/app/automation/providers/smtp-provider.js` | `createSmtpEmailProvider({ config })` |

`createEmailProviderAdapter` routes enabled `resend`, `sendgrid`, and `smtp` config to the corresponding skeleton factory. Mock provider unchanged.

**Script:** `scripts/verify-email-provider-skeletons.mjs`

`npm run verify-email-provider-skeletons` verifies skeleton module exports, not-implemented behaviour, adapter routing, absence of network/SDK hooks, and no `app.js` wiring.

### Phase 14 constraints

- Skeleton modules only — no real provider network calls, credentials, or outbound delivery
- Not imported in `app.js` or wired to delivery execution
- No mark-as-sent automation or compliance/action/history mutation

---

## Phase 15 — Provider skeleton foundation verification orchestrator

**Script:** `scripts/verify-email-provider-skeleton-foundation.mjs`

`npm run verify-email-provider-skeleton-foundation` runs provider and skeleton foundation verification in order:

1. `verify-email-provider-foundation` (phases 10–12 + delivery foundation)
2. `verify-email-provider-skeletons` (phase 14 skeleton modules)

Stops on first failure. Prints section headings for each step. Verification-only — no real email provider, network calls, production sending, mark-as-sent automation, or app behaviour changes.

### Phase 15 constraints

- Orchestration only — no app behaviour changes
- No real email provider, production delivery, or mark-as-sent automation
- No network calls or compliance/action/history mutation

---

## Phase 16 — Provider skeleton release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.3`), and release-readiness gate for the provider skeleton foundation slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.3):**

- V6 Phases 1–16 complete (delivery foundation phases 1–9 + provider foundation phases 10–13 + skeleton phases 14–16)
- Provider configuration complete (`getEmailProviderConfig`)
- Provider adapter complete (`createEmailProviderAdapter`)
- Provider skeleton modules complete (Resend, SendGrid, SMTP)
- Provider skeleton foundation verification orchestrator complete (`npm run verify-email-provider-skeleton-foundation`)
- **Disabled-by-default provider mode** (`enabled: false`, `mode: disabled`, `provider: none`)
- **Mock provider only**
- **No real provider implementation**
- **No network calls**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator (no live execution)

**Release candidate:** **v6.0.0-alpha.3**

### Phase 16 constraints

- Documentation and version display only — no app behaviour changes
- Skeleton modules only — no real provider network calls, production delivery, or mark-as-sent automation
- No compliance/action/history mutation

---

## Phase 17 — Resend implementation plan

**Scope:** Document the exact contract for the first real email provider (Resend) before writing network code in `createResendEmailProvider`. **Planning only** — no `fetch`, SDK, SMTP, production sending, or `app.js` wiring.

**Documentation:** [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md#phase-17--resend-implementation-plan) — full Resend plan (env vars, validation, test/production gates, failure mapping, rate limits, audit, rollback).

**Script:** `scripts/verify-resend-provider-plan.mjs`

`npm run verify-resend-provider-plan` verifies:

1. Resend implementation plan section exists in provider configuration doc
2. Required env vars, test/production gates, failure mapping, and rollback plan are documented
3. `resend-provider.js` remains skeleton — no `fetch`, SDK hooks, or live API calls

### Phase 17 deliverables

| Item | Location |
|------|----------|
| Resend implementation plan | `docs/v6-email-provider-configuration.md` § Phase 17 |
| Plan verification | `scripts/verify-resend-provider-plan.mjs` |
| Architecture cross-reference | This document § Phase 17 |

### Resend adapter contract (planned — Phase 19)

The Resend module will implement the existing `EmailProvider` interface from Phase 1:

| Method | Planned behaviour |
|--------|-------------------|
| `healthCheck()` | `GET /domains` — validate API key; confirm `EMAIL_FROM_ADDRESS` domain is verified |
| `sendReminder(input)` | `POST /emails` — map input to Resend payload; apply test-mode redirect; return structured result for executor retry logic |

Worker flow unchanged from Phase 1 contract: `prepared` → `sending` → `delivered` / `failed` with audit on every transition.

### Phase 17 constraints

- Planning documentation and verification only — no app behaviour changes
- `resend-provider.js` skeleton unchanged (`not_implemented` / throws)
- No network calls, production delivery, mark-as-sent automation, or compliance/action/history mutation

---

## Phase 18 — Resend plan release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.4`), and release-readiness gate for the Resend implementation plan slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.4):**

- V6 Phases 1–18 complete (delivery foundation phases 1–9 + provider foundation phases 10–13 + skeleton phases 14–16 + Resend plan phases 17–18)
- Resend implementation plan complete (env vars, validation, test/production gates, failure mapping, rate limits, audit, rollback)
- Resend plan verification complete (`npm run verify-resend-provider-plan`)
- Provider skeleton modules unchanged — `resend-provider.js` still `not_implemented`
- **Disabled-by-default provider mode** (`enabled: false`, `mode: disabled`, `provider: none`)
- **Mock provider only**
- **No Resend network implementation**
- **No API key usage**
- **No network calls**
- **No production sending**
- **No mark-as-sent automation**
- **No compliance/action/history mutation**

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

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | Delivery domain model (this document) | **Complete** |
| 2 | In-memory delivery record builder (`buildReminderDeliveryRecords`) | **Complete** |
| 3 | `reminder_delivery_logs` schema + RLS | **Complete** |
| 4 | Delivery log RPC draft (`create_reminder_delivery_log`, `get_reminder_delivery_logs`) | **Complete** |
| 5 | In-process delivery state machine (`transitionReminderDeliveryRecord`) | **Complete** |
| 6 | Mock email provider (`createMockEmailProvider`) | **Complete** |
| 7 | Mock delivery executor (`executeMockReminderDelivery`) | **Complete** |
| 8 | Delivery foundation verification orchestrator (`verify-delivery-foundation`) | **Complete** |
| 9 | Delivery foundation release readiness (`v6.0.0-alpha.1`) | **Complete** |
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
| 24 | Worker delivery execution engine (`executeReminderDeliveries`) | **Complete** |
| 25 | Delivery worker persistence adapter (`buildDeliveryLogPayloads`) | **Complete** |
| 26 | Delivery log persistence service (`persistDeliveryLogPayloads`) | **Complete** |
| 27 | Delivery pipeline service (`runDeliveryPipeline`) | **Complete** |
| 28 | Delivery pipeline foundation verification (`verify-delivery-pipeline-foundation`) | **Complete** |
| 29 | Delivery pipeline foundation release readiness (`v6.0.0-alpha.7`) | **Complete** |
| 30 | Manual delivery pipeline runner (`runManualDeliveryPipeline`) | **Complete** |
| 31 | Manual delivery foundation verification (`verify-manual-delivery-foundation`) | **Complete** |
| 32 | Manual delivery foundation release readiness (`v6.0.0-alpha.8`) | **Complete** |
| 33 | Admin manual delivery UI (`Manual Delivery Test` card) | **Complete** |
| 34 | Manual delivery E2E foundation verification (`verify-manual-delivery-e2e-foundation`) | **Complete** |
| 35 | Manual delivery E2E release readiness (`v6.0.0-beta.1`) | **Complete** |
| V6.1-1 | Beta validation checklist (`verify-beta-validation-checklist`) | **Complete** |
| 36 | Server-side delivery architecture plan (`verify-edge-delivery-plan`) | **Complete** |
| 37 | Edge Function skeleton (`send-reminder-deliveries`, `verify-edge-delivery-function-skeleton`) | **Complete** |
| 38 | Edge Function Resend integration (`verify-edge-delivery-resend`) | **Complete** |
| 39 | Browser invoke wiring + delivery log persistence | Planned |

**Constraints (V6.1 Phase 1):** Checklist documentation and verification only. Validates complete manual delivery workflow in staging before mark-as-sent automation. No new features, schema changes, RPC changes, or UI changes unless a bug is found.

**Next slice after V6.1 Phase 1:** V6 Phase 36 — Server-side delivery architecture plan (this phase).

---

## V6.1 Phase 1 — Beta validation

**Scope:** Controlled staging validation checklist for the manual delivery workflow on top of **v6.0.0-beta.1**. Documents ten test areas (queue, template/digest, manual delivery UI, test-mode Resend, real send path, missing/invalid email, CSV export, permissions, safety invariants) and runs mapped automated verification scripts.

**Deliverables:**

| Item | Location |
|------|----------|
| Beta validation checklist | `docs/v6-beta-validation.md` |
| Checklist verification | `scripts/verify-beta-validation-checklist.mjs` |

**Verification (required):**

- `npm run verify-beta-validation-checklist` — checklist completeness + automated test-area scripts

### V6.1 Phase 1 constraints

- Validation and documentation only — no mark-as-sent automation
- No new features, schema changes, RPC changes, or UI changes unless a bug is found
- Manual staging sign-off required for sections 3, 4, 5, 9, and 10 before Edge Function implementation

**Next slice after Phase 35:** V6.1 Phase 1 — Beta validation (this phase).

---

## Phase 36 — Server-side delivery architecture plan

**Scope:** Document why browser → Resend direct calls fail (CORS + exposed API key) and define the replacement path: **Browser Manual Delivery UI → Supabase Edge Function `send-reminder-deliveries` → Resend API → `create_reminder_delivery_log` RPC**. **Planning and safety only** — no deployed Edge Function, no browser invoke wiring, no live sends.

### Why browser → Resend failed

| Problem | Detail |
|---------|--------|
| **CORS** | Resend's REST API (`https://api.resend.com`) does not allow browser-origin requests. A `fetch` from the Manual Delivery UI is blocked by the browser preflight policy before the request reaches Resend. |
| **Exposed API key** | `RESEND_API_KEY` synced into `email-provider-env.js` is bundled in `app.bundle.js` and readable in DevTools by any user who can load the app — including non-admin roles if the bundle is shared. API keys must never ship to clients. |

### New architecture (planned)

```
Browser Manual Delivery UI
  → supabase.functions.invoke("send-reminder-deliveries")
  → Supabase Edge Function (holds RESEND_API_KEY in secrets)
  → Resend API POST /emails
  → create_reminder_delivery_log RPC → reminder_delivery_logs table
```

| Layer | Responsibility |
|-------|----------------|
| **Browser** | Build delivery records, admin confirmation, invoke Edge Function with JWT — **no** `api.resend.com` calls, **no** `RESEND_API_KEY` |
| **Edge Function** | Admin auth, test/production gates, Resend HTTP, delivery log persistence |
| **Postgres** | Immutable audit via existing `create_reminder_delivery_log` RPC |

### Secret handling rule

**`RESEND_API_KEY` must live only in Supabase Edge Function secrets** (`supabase secrets set`). The browser must never contain, read, or transmit the Resend API key. Non-secret provider settings (`EMAIL_MODE`, `EMAIL_FROM_ADDRESS`, `EMAIL_TEST_REDIRECT_TO`) may remain in `email-provider-env.js` for UI display.

### Phase 36 deliverables

| Item | Location |
|------|----------|
| Server-side architecture plan | This document § Phase 36 |
| Edge Function contract | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) |
| Plan verification | `scripts/verify-edge-delivery-plan.mjs` |

**Script:** `scripts/verify-edge-delivery-plan.mjs`

`npm run verify-edge-delivery-plan` verifies:

1. Architecture and Edge Function plan documents exist
2. CORS failure and API key exposure documented
3. Browser must not call Resend directly (documented requirement)
4. `RESEND_API_KEY` server-side-only rule documented
5. Edge Function `send-reminder-deliveries` architecture documented
6. No Edge Function implementation, no new `supabase/functions` deploy artefacts, no browser send-path changes in this phase

### Phase 36 constraints

- Planning documentation and verification only — no app behaviour changes
- No deployed Edge Function, no `supabase.functions.invoke` wiring, no live Resend calls
- No mark-as-sent automation, schema changes, or RPC changes
- Existing in-browser `createResendEmailProvider` remains for unit tests with mocked `fetchImpl` until Phase 37+ implementation

**Phase 36 gate:** `npm run verify-edge-delivery-plan` must pass.

**Next slice after Phase 36:** V6 Phase 37 — Edge Function skeleton (`send-reminder-deliveries`).

---

## Phase 37 — Edge Function skeleton

**Scope:** Create `supabase/functions/send-reminder-deliveries/index.ts` — POST-only handler with Authorization header check, JSON body parsing, required field validation (`organisationId`, `automationRunId`, `deliveryRecords`), OPTIONS CORS preflight, and `200` response `{ status: "not_implemented", message: "Server-side delivery is not implemented yet" }`. **Skeleton only** — no Resend API calls, no `RESEND_API_KEY` reads, no delivery log writes, no browser invoke wiring.

### Skeleton behaviour

| Method | Response |
|--------|----------|
| `OPTIONS` | `200` with CORS headers (localhost `127.0.0.1:8877` / `localhost:8877`; staging origins via future `EDGE_DELIVERY_ALLOWED_ORIGINS` secret) |
| `POST` (missing `Authorization`) | `401` |
| `POST` (invalid JSON / missing fields) | `400` |
| `POST` (valid body) | `200` `{ status: "not_implemented", message: "Server-side delivery is not implemented yet" }` |
| Other methods | `405` |

### Phase 37 deliverables

| Item | Location |
|------|----------|
| Edge Function skeleton | `supabase/functions/send-reminder-deliveries/index.ts` |
| Skeleton verification | `scripts/verify-edge-delivery-function-skeleton.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 37 |

**Script:** `scripts/verify-edge-delivery-function-skeleton.mjs`

`npm run verify-edge-delivery-function-skeleton` verifies:

1. `index.ts` exists with `Deno.serve`, POST and OPTIONS handlers
2. Required field validation for `organisationId`, `automationRunId`, `deliveryRecords`
3. Returns `not_implemented` response on valid POST
4. No Resend API call, `RESEND_API_KEY`, delivery log writes, or mark-as-sent/compliance/history mutation
5. No browser invoke wiring in `manual-delivery-execution.js`

### Phase 37 constraints

- Edge Function skeleton only — no Resend calls, no real email sending
- No delivery log RPC writes, no mark-as-sent automation
- No app UI changes, no `supabase.functions.invoke` wiring
- Deploy to Supabase is optional in this phase — local `supabase functions serve` for manual smoke only

**Phase 37 gate:** `npm run verify-edge-delivery-function-skeleton` must pass.

**Next slice after Phase 37:** V6 Phase 38 — Edge Function Resend integration (this phase).

---

## Phase 38 — Edge Function Resend integration

**Scope:** Implement server-side Resend sending in `supabase/functions/send-reminder-deliveries/index.ts`. Reads `RESEND_API_KEY`, `EMAIL_MODE`, `EMAIL_FROM_ADDRESS`, `EMAIL_REPLY_TO_ADDRESS`, `EMAIL_TEST_REDIRECT_TO`, and `EMAIL_RATE_LIMIT_PER_RUN` from Edge Function secrets. **Edge Function only** — no browser `supabase.functions.invoke` wiring, no delivery log RPC writes, no mark-as-sent automation.

### Provider configuration (fail closed)

| Check | Failure |
|-------|---------|
| Missing `RESEND_API_KEY` | `503` `{ error: "provider_not_configured" }` |
| `EMAIL_MODE` not `test` or `production` | `503` `{ error: "invalid_email_mode" }` |
| Missing `EMAIL_FROM_ADDRESS` | `503` `{ error: "invalid_config" }` |
| `EMAIL_MODE=test` without `EMAIL_TEST_REDIRECT_TO` | `503` `{ error: "invalid_config" }` |

### Test vs production mode

| Mode | Behaviour |
|------|-----------|
| `test` | Redirect all recipients to `EMAIL_TEST_REDIRECT_TO`; prefix subject with `[TEST]` |
| `production` | Send to real `recipientEmail` (requires explicit `EMAIL_MODE=production` secret) |

### Sending and failure mapping

- `POST https://api.resend.com/emails` from Edge Function only
- `2xx` → per-record `delivered` with `providerMessageId`
- `429` / `5xx` → `failed` with `failureType: "transient"`
- Other `4xx` → `failed` with `failureType: "permanent"`
- Network errors → `failed` with `failureReason: "resend_network_error"`

### Rate limit

`EMAIL_RATE_LIMIT_PER_RUN` caps send attempts per invocation (default `50`). Additional prepared records are `skipped` with `skipReason: "rate_limit_exceeded"`.

### Response shape

```json
{
  "status": "ok",
  "summary": {
    "total": 2,
    "attempted": 2,
    "delivered": 2,
    "failed": 0,
    "skipped": 0
  },
  "results": [
    {
      "queueItemId": "queue-item-1",
      "deliveryStatus": "delivered",
      "providerMessageId": "re_abc123"
    }
  ]
}
```

### Phase 38 deliverables

| Item | Location |
|------|----------|
| Resend integration | `supabase/functions/send-reminder-deliveries/index.ts` |
| Resend verification | `scripts/verify-edge-delivery-resend.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 38 |

**Script:** `scripts/verify-edge-delivery-resend.mjs`

`npm run verify-edge-delivery-resend` verifies:

1. Edge Function reads `RESEND_API_KEY` and provider env vars server-side
2. Calls Resend API with test redirect, `[TEST]` prefix, and failure mapping
3. Returns `summary` and per-record `results`
4. No delivery log writes, mark-as-sent hooks, or browser invoke wiring

### Phase 38 constraints

- Edge Function Resend integration only — no `supabase.functions.invoke` wiring in app yet
- Legacy browser provider scaffold retained in `manual-delivery-execution.js` / `resend-provider.js` for pre-Phase-39 staging; **inert when committed `email-provider-env.js` is all `undefined`**
- No `create_reminder_delivery_log` RPC writes yet
- No mark-as-sent automation, scheduled execution, or compliance/history mutation
- **After Phase 39:** browser must not be the production sending path — Manual Delivery UI invokes Edge Function only

### Dual-path transition (Phase 38)

| Path | Active in committed git? | Production use |
|------|--------------------------|----------------|
| Edge Function `send-reminder-deliveries` | Code present; requires deploy + secrets | **Yes** (authoritative after Phase 39 wiring) |
| Browser `createResendEmailProvider` | **No** — `email-provider-env.js` disables provider | **No** — legacy scaffold only until Phase 39 removes browser sends |

`verify-edge-delivery-resend` distinguishes forbidden committed secrets and premature Edge invoke from allowed legacy scaffold.

**Phase 38 gate:** `npm run verify-edge-delivery-resend` must pass.

---

## Phase 39 — Browser invoke wiring

**Scope:** Wire Manual Delivery UI to invoke `send-reminder-deliveries` via authenticated `supabase.functions.invoke`. Browser no longer sends directly to Resend.

### Phase 39 deliverables

| Item | Location |
|------|----------|
| Edge invoke client | `js/app/automation/edge-delivery-invoke.js` |
| Manual execution coordinator | `js/app/automation/manual-delivery-execution.js` |
| Browser invoke verification | `scripts/verify-edge-delivery-browser-invoke.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 39 |

**Script:** `scripts/verify-edge-delivery-browser-invoke.mjs`

`npm run verify-edge-delivery-browser-invoke` verifies:

1. `manual-delivery-execution.js` invokes `send-reminder-deliveries` with `organisationId`, `automationRunId`, and `deliveryRecords`
2. No `createResendEmailProvider`, `RESEND_API_KEY`, or `api.resend.com` in manual execution path
3. `resend-provider.js` retained but not used by manual execution
4. No delivery log writes, mark-as-sent hooks, or compliance/history mutation in manual execution
5. Phase 37/38 Edge Function checks still pass via sibling verify scripts

### Phase 39 constraints

- Browser invoke wiring only — no `create_reminder_delivery_log` RPC writes yet
- No mark-as-sent automation, scheduled execution, or compliance/history mutation
- **Browser must not be the production sending path** — Manual Delivery invokes Edge Function only
- `RESEND_API_KEY` in Supabase Edge Function secrets only — not in browser bundle

### Post-Phase-39 path model

| Path | Active in committed git? | Production use |
|------|--------------------------|----------------|
| Edge Function `send-reminder-deliveries` | Code present; requires deploy + secrets | **Yes** (authoritative) |
| Browser `edge-delivery-invoke.js` | Wired to Manual Delivery UI | **Yes** (invoke only) |
| Browser `createResendEmailProvider` | Scaffold retained in `resend-provider.js` | **No** — deprecated/inert |

**Phase 39 gate:** `npm run verify-edge-delivery-browser-invoke` must pass.

**Next slice after Phase 39:** Edge Function test-mode deployment readiness (Phase 40).

---

## Phase 40 — Edge Function test-mode deployment readiness

**Scope:** Prepare safe deployment and testing of `send-reminder-deliveries` in Supabase **test mode** only. Deployment checklist, secret checklist, local/staging smoke test plans, and automated readiness verification — **no new application logic**.

### Phase 40 deliverables

| Item | Location |
|------|----------|
| Deployment readiness checklist | [`docs/v6-edge-delivery-test-deployment.md`](v6-edge-delivery-test-deployment.md) |
| Readiness verification gate | `scripts/verify-edge-delivery-test-deployment.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 40 |

**Script:** `scripts/verify-edge-delivery-test-deployment.mjs`

`npm run verify-edge-delivery-test-deployment` verifies:

1. Deployment doc covers all six required Edge Function secrets with `EMAIL_MODE=test`
2. Test redirect to `EMAIL_TEST_REDIRECT_TO` and `[TEST]` subject prefix documented and present in Edge Function code
3. Missing-secret failures (`503 provider_not_configured`, `invalid_email_mode`, `invalid_config`) documented and coded
4. Browser invokes Edge Function only — no `api.resend.com` or `RESEND_API_KEY` in manual execution path
5. No delivery log writes, mark-as-sent hooks, or compliance/history mutation in Edge Function or manual execution
6. Prerequisite Phase 37–39 verify scripts still pass

### Phase 40 constraints

- Test mode only — `EMAIL_MODE=test` in Supabase secrets; no production sending
- Documentation and verification only — deploy secrets + function for manual smoke sign-off
- No `create_reminder_delivery_log` RPC writes yet
- No mark-as-sent automation, scheduled execution, or compliance/history mutation

**Phase 40 gate:** `npm run verify-edge-delivery-test-deployment` must pass.

**Next slice after Phase 40:** V6 Phase 41 — test-mode deployment smoke test.

---

## Phase 41 — Test-mode deployment smoke test

**Scope:** Guide and verify the **first safe staging deployment** of `send-reminder-deliveries` with `EMAIL_MODE=test`. Manual smoke checklist, email inbox checks, Supabase dashboard checks, and automated smoke-plan verification — **no delivery log writes, mark-as-sent, or production sends**.

### Phase 41 deliverables

| Item | Location |
|------|----------|
| Manual smoke test checklist | [`docs/v6-edge-delivery-test-deployment.md`](v6-edge-delivery-test-deployment.md) § Phase 41 |
| Smoke plan verification gate | `scripts/verify-edge-delivery-test-smoke-plan.mjs` |
| UI result summary | `index.html` + `manual-delivery-ui.js` — attempted/delivered/failed/skipped |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 41 |

**Script:** `scripts/verify-edge-delivery-test-smoke-plan.mjs`

`npm run verify-edge-delivery-test-smoke-plan` verifies:

1. Phase 41 manual smoke checklist documents all required checks (admin sign-in, Edge Function invoke, test redirect, `[TEST]` subject, UI summary, no persistence/mutation)
2. UI wires skipped count from Edge Function `summary` (replaces persisted for smoke-test path)
3. `npm run build` succeeds
4. `npm run verify-edge-delivery-test-deployment` still passes

### Phase 41 constraints

- Test mode only — `EMAIL_MODE=test` in Supabase secrets
- Manual smoke sign-off after deploy — no automated Resend/Supabase smoke in verify script
- No `create_reminder_delivery_log` RPC writes
- No mark-as-sent automation, scheduled execution, or compliance/history mutation

**Phase 41 gate:** `npm run verify-edge-delivery-test-smoke-plan` must pass.

**Next slice after Phase 41:** V6 Phase 42 — delivery log persistence from Edge Function outcomes.

---

## Phase 42 — Delivery log persistence

**Scope:** Persist `send-reminder-deliveries` outcomes to `reminder_delivery_logs` via `create_reminder_delivery_log` inside the Edge Function. One row per `deliveryRecords` item (delivered, failed, skipped). Caller JWT RPC path — no browser service-role key, no mark-as-sent, no compliance/history mutation.

### Phase 42 deliverables

| Item | Location |
|------|----------|
| Edge Function persistence | `supabase/functions/send-reminder-deliveries/index.ts` — `persistDeliveryLog` + `create_reminder_delivery_log` |
| Browser summary mapping | `manual-delivery-execution.js` — `mapEdgeResponseToPersistenceSummary` |
| Verification gate | `scripts/verify-edge-delivery-log-persistence.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 42 |

**Script:** `scripts/verify-edge-delivery-log-persistence.mjs`

`npm run verify-edge-delivery-log-persistence` verifies:

1. Edge Function calls `create_reminder_delivery_log` with delivered/failed/skipped outcome mapping
2. Test-mode redirect stored in metadata (`redirectedToEmail`, `originalRecipientEmail`)
3. No `SUPABASE_SERVICE_ROLE_KEY` in Edge Function or browser invoke path
4. No mark-as-sent, compliance, or history mutation hooks
5. Existing RPC/table migrations — no new migration in Phase 42

### Phase 42 constraints

- Delivery log writes only — no mark-as-sent automation
- `EMAIL_MODE=test` safe — test redirect + `[TEST]` subject preserved in audit rows
- Browser UI continues to show execution summary; Delivery Operations Log loads persisted rows via `get_reminder_delivery_logs`

**Phase 42 gate:** `npm run verify-edge-delivery-log-persistence` must pass.

**Next slice after Phase 42:** V6 Phase 43 — mark reminders sent after Edge delivery.

---

## Phase 43 — Mark reminders sent after Edge delivery

**Scope:** Call existing `mark_reminder_sent` RPC from the Edge Function after delivered outcomes are persisted. **Test mode only** — Manual Delivery Test path; no scheduled execution.

### Phase 43 deliverables

| Item | Location |
|------|----------|
| Edge Function mark-as-sent | `supabase/functions/send-reminder-deliveries/index.ts` — `maybeMarkReminderSentAfterDelivery` |
| Compliance record linkage | `reminder-queue.js`, `reminder-delivery-record-builder.js`, `edge-delivery-invoke.js` |
| UI summary | `manual-delivery-ui.js`, `app.js`, `index.html` |
| Verification gate | `scripts/verify-edge-delivery-mark-sent.mjs` |
| Contract cross-reference | [`docs/v6-edge-delivery-function.md`](v6-edge-delivery-function.md) § Phase 43 |

**Script:** `scripts/verify-edge-delivery-mark-sent.mjs`

`npm run verify-edge-delivery-mark-sent` verifies:

1. Edge Function calls `mark_reminder_sent` only after `persistResult.persisted` on delivered outcomes
2. Test-mode gate (`EMAIL_MODE=test`) — no production mark-as-sent
3. Skipped and failed outcome branches never call mark-as-sent
4. `complianceRecordId` forwarded from queue → delivery records → Edge invoke
5. Browser manual delivery path has no `mark_reminder_sent` RPC writes
6. UI shows mark-sent summary counts when Edge response includes them

### Phase 43 constraints

- Delivered + persisted outcomes only — skipped/failed/unpersisted never marked
- Test mode only — production `EMAIL_MODE` unchanged
- Uses existing `mark_reminder_sent` RPC (notes + history behaviour unchanged)
- Browser displays counts only — server-side RPC via Edge Function

**Phase 43 gate:** `npm run verify-edge-delivery-mark-sent` must pass.

**Next slice:** V6 Phase 45 — scheduled automation runner dry run.

---

## Phase 45 — Scheduled automation runner dry run

**Scope:** Add `scheduled-reminder-runner` Edge Function that computes reminder candidates for an organisation using the same rules as Manual Delivery Test queue preview. **Dry run only** — no Resend, no `send-reminder-deliveries`, no delivery log writes, no mark-as-sent, no cron deployment.

### Phase 45 deliverables

| Item | Location |
|------|----------|
| Edge Function dry run | `supabase/functions/scheduled-reminder-runner/index.ts` |
| Client candidate helper | `js/app/automation/scheduled-runner-candidates.js` |
| Verification gate | `scripts/verify-scheduled-runner-dry-run.mjs` |
| Contract reference | [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) |

**Script:** `scripts/verify-scheduled-runner-dry-run.mjs`

`npm run verify-scheduled-runner-dry-run` verifies:

1. Edge Function requires Authorization and validates `organisationId`
2. Response includes `mode: "dry_run"` and summary (`totalCandidates`, `withEmail`, `missingEmail`, `wouldSend`, `wouldSkip`)
3. Fixture parity with Manual Delivery Test queue preview (`buildReminderQueueFromDryRun`)
4. No Resend, delivery log RPCs, mark-as-sent, or `send-reminder-deliveries` in the runner

### Phase 45 constraints

- Read-only server scan — `people`, `compliance_records`, `reminder_settings` SELECT only
- No `automation_runs` writes in Phase 45 (added in Phase 47)
- No cron schedule deployed — documented only
- Production `EMAIL_MODE` unchanged

**Phase 45 gate:** `npm run verify-scheduled-runner-dry-run` must pass.

**Next slice:** V6 Phase 46 — deploy and smoke-test scheduled runner dry run.

---

## Phase 46 — Deploy and smoke-test scheduled runner dry run

**Scope:** Deploy `scheduled-reminder-runner` to staging (`vmrotpztwoeifbdjwdis`) and document manual dry-run invocation. **No automatic emails, no cron, no delivery logs, no mark-as-sent, no compliance/history mutation.**

### Phase 46 deliverables

| Item | Location |
|------|----------|
| Deploy + smoke docs | [`docs/v6-scheduled-runner.md`](v6-scheduled-runner.md) § Phase 46 |
| Dry-run verification gate | `scripts/verify-scheduled-runner-dry-run.mjs` |
| Deploy smoke gate | `scripts/verify-scheduled-runner-deploy-smoke.mjs` |

**Deploy command (staging):**

```powershell
supabase functions deploy scheduled-reminder-runner --project-ref vmrotpztwoeifbdjwdis
```

**Script:** `scripts/verify-scheduled-runner-deploy-smoke.mjs`

`npm run verify-scheduled-runner-deploy-smoke` verifies:

1. Phase 46 deploy command, manual invocation (Dashboard + PowerShell), and expected response shape
2. Static safety gates — no Resend, `send-reminder-deliveries`, delivery logs, mark-as-sent, or cron
3. Preflight: `build` + `verify-scheduled-runner-dry-run`

### Phase 46 constraints

- Manual invoke only — no cron schedule deployed
- Response `status: "ok"`, `mode: "dry_run"`, summary counts only
- No email secrets required on the function
- `reminder_delivery_logs` and compliance/history unchanged after smoke test

**Phase 46 gate:** `npm run verify-scheduled-runner-deploy-smoke` must pass.

**Next slice:** V6 Phase 47 — automation run records for scheduled runner dry-runs.

---

## Phase 47 — Automation run records for scheduled runner dry-runs

**Scope:** Persist one `automation_runs` audit row when `scheduled-reminder-runner` completes a valid dry-run scan. **No Resend, no delivery logs, no mark-as-sent, no compliance/history mutation.**

### Phase 47 deliverables

| Item | Location |
|------|----------|
| Schema extension | `supabase/migrations/20260401000008_automation_runs_scheduled_dry_run.sql` |
| Edge Function insert | `supabase/functions/scheduled-reminder-runner/index.ts` |
| Verification gate | `scripts/verify-automation-run-records.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Script:** `scripts/verify-automation-run-records.mjs`

`npm run verify-automation-run-records` verifies:

1. Phase 47 migration extends `automation_runs` with dry-run audit columns
2. RLS enabled on `automation_runs` (foundation migration)
3. Service-role insert path in `scheduled-reminder-runner`
4. Response includes `automationRunId` from inserted row
5. Static safety gates — no Resend, delivery logs, mark-as-sent, or reminder mutation

### Phase 47 constraints

- `automation_runs` insert only — service role, dry-run audit
- Insert failure returns HTTP 500 — no partial success
- Response `automationRunId` matches `automation_runs.automation_run_id`
- `summary` JSON mirrors response summary counts

**Phase 47 gate:** `npm run verify-automation-run-records` must pass.

**Next slice:** V6 Phase 49 — delivery log schema for future email sends.

---

## Phase 49 — Delivery log schema for future email sends

**Scope:** Create `public.reminder_delivery_logs` for future scheduled email delivery auditing. **Schema and verification only** — no Edge Function writes, no Resend, no mark-as-sent, and no connection from `scheduled-reminder-runner` to delivery logs.

### Phase 49 deliverables

| Item | Location |
|------|----------|
| Schema migration | `supabase/migrations/20260401000009_reminder_delivery_logs_scheduled_send_schema.sql` |
| Verification gate | `scripts/verify-reminder-delivery-log-schema.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Migration:** Replaces the Phase 3 foundation table shape with scheduled-send audit columns: org/run/compliance/person linkage, recipient fields, `delivery_status` (`pending` \| `sent` \| `skipped` \| `failed`), provider fields, `payload` jsonb, `created_at`, and nullable `sent_at`.

**Indexes:** `organisation_id`, `automation_run_id`, `compliance_record_id`, `delivery_status`, `created_at desc`, partial `provider_message_id`.

**RLS:** Org-scoped `select` for authenticated users. No authenticated insert/update/delete policies — writes remain server-side only.

**Script:** `scripts/verify-reminder-delivery-log-schema.mjs`

`npm run verify-reminder-delivery-log-schema` verifies:

1. Phase 49 migration exists with table, columns, constraint, and indexes
2. RLS enabled — select policy only, no client write policies
3. `scheduled-reminder-runner` remains dry-run only with no delivery log / Resend / mark-as-sent usage

### Phase 49 constraints

- Schema migration only — no Edge Function or app wiring
- `automation_run_id` FK references `automation_runs.automation_run_id` (Phase 47 column)
- `recipient_email` and `provider` nullable for skipped / not-yet-sent rows
- No `sent_at` writes from functions yet

**Phase 49 gate:** `npm run verify-reminder-delivery-log-schema` must pass.

**Next slice:** V6 Phase 50 — staging verification for `reminder_delivery_logs` schema.

---

## Phase 50 — Staging verification for reminder_delivery_logs schema

**Scope:** Confirm the Phase 49 `reminder_delivery_logs` migration is applied on live staging. **Verification only** — no Edge Function writes, Resend, mark-as-sent, or app behaviour changes.

### Phase 50 deliverables

| Item | Location |
|------|----------|
| Staging verification gate | `scripts/verify-reminder-delivery-log-schema-staging.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Prerequisites:** Phase 49 migration applied on staging; `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; Supabase CLI login or `SUPABASE_ACCESS_TOKEN` for catalog introspection.

**Script:** `scripts/verify-reminder-delivery-log-schema-staging.mjs`

`npm run verify-reminder-delivery-log-schema-staging` verifies against the live staging database:

1. `public.reminder_delivery_logs` exists with Phase 49 columns (Phase 3 shape absent)
2. `delivery_status` check constraint: `pending` \| `sent` \| `skipped` \| `failed`
3. Expected indexes, including partial `provider_message_id`
4. RLS enabled — `reminder_delivery_logs_org_select` only; no authenticated write policies
5. `automation_run_id` FK → `automation_runs.automation_run_id`
6. PostgREST column/FK relationship checks; optional authenticated RLS posture when anon key + test password are configured

Catalog/introspection queries are preferred; the script does not insert test delivery logs.

### Phase 50 constraints

- Staging schema verification only — no delivery log writes or email sends
- No `scheduled-reminder-runner` behaviour changes
- No app wiring

**Phase 50 gate:** `npm run verify-reminder-delivery-log-schema-staging` must pass against staging.

**Next slice:** V6 Phase 51 — dry-run delivery log creation from `scheduled-reminder-runner` (complete).

---

## Phase 51 — Dry-run delivery log creation for scheduled runner

**Scope:** `scheduled-reminder-runner` inserts one `reminder_delivery_logs` row per dry-run candidate after `automation_runs` insert. **Dry-run only** — `delivery_status` is `pending` or `skipped`; no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes. **Not transactional** with automation run insert.

### Phase 51 deliverables

| Item | Location |
|------|----------|
| Edge Function insert path | `supabase/functions/scheduled-reminder-runner/index.ts` |
| Verification gate | `scripts/verify-scheduled-runner-delivery-log-dry-run.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Script:** `scripts/verify-scheduled-runner-delivery-log-dry-run.mjs`

`npm run verify-scheduled-runner-delivery-log-dry-run` verifies:

1. `reminder_delivery_logs` insert after `automation_runs` insert
2. `delivery_status` uses `pending` / `skipped` only
3. Response includes `deliveryLogSummary`
4. No Resend, email send, `mark_reminder_sent`, or `sent_at` assignment
5. `scheduled-reminder-runner` remains `dry_run` mode only

### Phase 51 constraints

- Dry-run delivery log rows only — no live sends
- `provider` and `provider_message_id` null; `sent_at` not set
- No app UI changes
- Automation run row may exist if delivery log insert fails (no transaction yet)

**Phase 51 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run` must pass.

**Next slice:** V6 Phase 52 — staging verification for dry-run delivery logs (complete).

---

## Phase 52 — Staging verification for dry-run delivery logs

**Scope:** Live staging invoke of `scheduled-reminder-runner` dry-run; confirm `reminder_delivery_logs` rows linked to `automationRunId`. **Verification only** — no Resend, no email sends, no `mark_reminder_sent`, no `sent_at` writes.

### Phase 52 deliverables

| Item | Location |
|------|----------|
| Staging verification gate | `scripts/verify-scheduled-runner-delivery-log-dry-run-staging.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Script:** `scripts/verify-scheduled-runner-delivery-log-dry-run-staging.mjs`

`npm run verify-scheduled-runner-delivery-log-dry-run-staging` verifies:

1. Deployed dry-run invoke returns `automationRunId` and `deliveryLogSummary`
2. `reminder_delivery_logs` row count matches `deliveryLogSummary.total`
3. `pending` / `skipped` counts match summary; `sent` and `failed` are `0`
4. No row has `sent_at` or `provider_message_id`; `provider` is null; `payload.mode` is `dry_run`
5. Every row `organisation_id` matches request; matching `automation_runs` row exists

### Phase 52 constraints

- Staging verification only — no schema or Edge Function changes
- No real email delivery checks
- No app UI changes

**Phase 52 gate:** `npm run verify-scheduled-runner-delivery-log-dry-run-staging` must pass against staging.

**Next slice:** V6 Phase 53 — reminder email template framework (complete).

---

## Phase 53 — Reminder email template framework

**Scope:** Plain-text reminder email subject/body generation, token replacement, and preview helpers for future scheduled sends. **Template/preview only** — no Resend, no email sending, no delivery status changes, no `mark_reminder_sent`, and no `sent_at` or `provider_message_id` writes.

### Phase 53 deliverables

| Item | Location |
|------|----------|
| Template module | `js/app/automation/reminder-email-template.js` |
| Verification gate | `scripts/verify-reminder-email-template.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Script:** `scripts/verify-reminder-email-template.mjs`

`npm run verify-reminder-email-template` verifies:

1. Subject renders with compliance type and ISO due date
2. Body renders recipient, person, compliance, and formatted due date fields
3. Missing fields use fallbacks — no `undefined` or `null` in output
4. `replaceReminderEmailTokens` replaces all supported `{{token}}` placeholders
5. `buildReminderEmailPreview` returns `subject` and `bodyText`
6. Module contains no Resend, fetch, send, database write, or mark-as-sent patterns

### Phase 53 constraints

- Template generation only — no provider or Edge Function wiring
- Plain text only — no HTML
- No app UI changes
- No `scheduled-reminder-runner` behaviour changes

**Phase 53 gate:** `npm run verify-reminder-email-template` must pass.

**Next slice:** V6 Phase 54 — Edge Resend provider foundation (complete).

---

## Phase 54 — Edge Resend provider foundation (disabled by default)

**Scope:** Shared Edge email provider module with configuration parsing, provider abstraction, and safety gates for future scheduled sends. **Disabled by default** — no live email sending, no `scheduled-reminder-runner` send path, no delivery status changes, no `mark_reminder_sent`, and no `sent_at` or `provider_message_id` writes.

### Phase 54 deliverables

| Item | Location |
|------|----------|
| Edge shared provider module | `supabase/functions/_shared/email-provider.ts` |
| Verification gate | `scripts/verify-resend-provider-foundation.mjs` |
| Browser foundation orchestrator (Phase 20) | `scripts/verify-browser-resend-provider-foundation.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Script:** `scripts/verify-resend-provider-foundation.mjs`

`npm run verify-resend-provider-foundation` verifies:

1. `email-provider.ts` exports `getEmailProviderConfig`, `isEmailSendingEnabled`, `createEmailProvider`, `sendReminderEmail`
2. `EMAIL_SENDING_ENABLED` defaults to `false`; `EMAIL_PROVIDER` defaults to `resend`
3. Missing `RESEND_API_KEY` is safe when sending is disabled
4. `scheduled-reminder-runner` does not import Resend or `email-provider`
5. Only `verify-email-provider-disabled` may call `sendReminderEmail` (Phase 55); `scheduled-reminder-runner` must not
6. Provider module has no `delivery_status`, `sent_at`, `provider_message_id`, or `mark_reminder_sent` patterns
7. No live Resend calls; `npm run build` passes without `RESEND_API_KEY`

### Phase 54 configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `EMAIL_SENDING_ENABLED` | `false` | Explicit `true` required to reach Resend scaffold |
| `EMAIL_PROVIDER` | `resend` | Provider name |
| `RESEND_API_KEY` | — | Required only when sending enabled |
| `EMAIL_FROM_ADDRESS` | — | Required only when sending enabled |

### Phase 54 constraints

- Provider abstraction and configuration gates only
- `sendReminderEmail` returns `{ status: "disabled" }` when sending is off — no provider HTTP calls
- Resend HTTP scaffold exists in `_shared/email-provider.ts` but is unreachable unless `EMAIL_SENDING_ENABLED=true`
- No `scheduled-reminder-runner` behaviour changes
- No app UI changes

**Phase 54 gate:** `npm run verify-resend-provider-foundation` must pass.

**Next slice:** V6 Phase 55 — provider disabled-mode staging verification (complete).

---

## Phase 55 — Provider disabled-mode staging verification

**Scope:** Live staging invoke of temporary `verify-email-provider-disabled` Edge Function; confirm `EMAIL_SENDING_ENABLED` is off on the deployed runtime and `sendReminderEmail` returns a safe disabled result. **Verification only** — no real email sends, no `scheduled-reminder-runner` wiring, no delivery status changes, no `mark_reminder_sent`, and no `sent_at` or `provider_message_id` writes.

### Phase 55 deliverables

| Item | Location |
|------|----------|
| Staging verification Edge Function | `supabase/functions/verify-email-provider-disabled/index.ts` |
| Staging verification gate | `scripts/verify-email-provider-disabled-staging.mjs` |
| Contract reference | [`docs/v6-automated-email-reminders.md`](v6-automated-email-reminders.md) |

**Deploy before staging verification:**

```powershell
supabase functions deploy verify-email-provider-disabled --project-ref vmrotpztwoeifbdjwdis
```

**Script:** `scripts/verify-email-provider-disabled-staging.mjs`

`npm run verify-email-provider-disabled-staging` verifies:

1. `scheduled-reminder-runner` does not import `email-provider` or call `sendReminderEmail`
2. Deployed invoke returns `status: ok`, `mode: provider_disabled_verification`, `emailProviderStatus: disabled`
3. Response and `providerResult` have no `providerMessageId` or `sent_at`
4. `reminder_delivery_logs` row count unchanged after invoke
5. `providerResult.status` is `disabled` with reason `email_sending_disabled`

### Phase 55 constraints

- Staging verification only — no real email delivery
- `RESEND_API_KEY` not required when sending disabled
- No `scheduled-reminder-runner` behaviour changes
- No app UI changes

**Phase 55 gate:** `npm run verify-email-provider-disabled-staging` must pass against staging.

**Next slice:** TBD — wire provider into scheduled-reminder-runner send path.

---

**Constraints (Phase 41):** Test-mode smoke sign-off only. No production sends, mark-as-sent, or compliance/history mutation in Phase 41 scope.

**Next slice after Phase 41:** V6 Phase 42 — delivery log persistence (complete).


**Next slice after Phase 35:** V6.1 Phase 1 — Beta validation.

---

## Phase 35 — Manual delivery E2E release readiness

**Scope:** Documentation, version bump (`v6.0.0-beta.1`), and release-readiness gate for the admin manual delivery UI and E2E safety stack. No application logic changes.

**Release-readiness note (v6.0.0-beta.1):**

- V6 Phases 1–35 complete
- Admin-only manual delivery UI complete (`Manual Delivery Test` card)
- Manual delivery E2E foundation verification complete (`verify-manual-delivery-e2e-foundation`)
- **No scheduled execution**
- **No automatic execution**
- **No mark-as-sent automation yet**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-manual-delivery-e2e-foundation` — full manual delivery E2E foundation stack

**Release candidate:** **v6.0.0-beta.1**

### Phase 35 constraints

- Documentation and version display only — no mark-as-sent automation yet
- No scheduled execution or automatic execution

---

**Constraints (Phase 34):** Verification orchestrator only. Runs manual delivery foundation, Resend provider foundation, delivery operations log UI, and manual delivery UI checks with static secret-safety gates. No scheduled execution, automatic execution, mark-as-sent automation, or compliance/history mutation.

**Next slice after Phase 34:** V6 Phase 35 — Manual delivery E2E release readiness.

---

## Phase 34 — Manual delivery UI end-to-end verification gate

**Scope:** `scripts/verify-manual-delivery-e2e-foundation.mjs` orchestrator. Runs in order:

1. `npm run verify-manual-delivery-foundation`
2. `npm run verify-browser-resend-provider-foundation`
3. `npm run verify-delivery-operations-log-ui`
4. `npm run verify-manual-delivery-ui`

Static safety checks: no committed Resend API key in `email-provider-env.js`, no hardcoded `RESEND_API_KEY` in `app.js`, admin/cloud-write gating on run button.

Stops on first failure. Prints `V6 manual delivery E2E foundation verification: OK` on success.

### Phase 34 deliverables

| Item | Location |
|------|----------|
| E2E foundation orchestrator | `scripts/verify-manual-delivery-e2e-foundation.mjs` |

### Phase 34 constraints

- Verification orchestrator and documentation only
- No scheduled execution, automatic execution, or mark-as-sent automation
- No compliance record or history mutation

---

**Constraints (Phase 33):** Admin-only manual delivery test UI. Invokes `runManualDeliveryPipeline` from reminder preview queue with confirmation. No scheduling, automatic execution, or mark-as-sent automation.

**Next slice after Phase 33:** V6 Phase 34 — Manual delivery UI end-to-end verification gate.

---

## Phase 33 — Admin manual delivery UI

**Scope:** **Manual Delivery Test** card — cloud mode + admin role only. Displays queue summary, provider delivery mode (read-only), confirmation dialog, loading state, and result summary (attempted, delivered, failed, persisted).

**Verification:** `npm run verify-manual-delivery-ui`

### Phase 33 deliverables

| Item | Location |
|------|----------|
| Manual delivery UI helpers | `js/app/automation/manual-delivery-ui.js` |
| Manual delivery execution coordinator | `js/app/automation/manual-delivery-execution.js` |
| UI verification | `scripts/verify-manual-delivery-ui.mjs` |

### Phase 33 constraints

- Manual execution only — admin-initiated
- No scheduling or automatic execution
- No mark-as-sent automation
- No compliance record or history mutation

---

**Constraints (Phase 32):** Documentation and version bump only. Manual delivery runner and foundation verification complete at service level. No UI send button, scheduled execution, mark-as-sent automation, or `app.js` execution wiring.

**Next slice after Phase 32:** V6 Phase 33 — Admin manual delivery UI.

---

## Phase 32 — Manual delivery foundation release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.8`), and release-readiness gate for the manual delivery foundation stack. No application logic changes.

**Release-readiness note (v6.0.0-alpha.8):**

- V6 Phases 1–32 complete
- Manual delivery pipeline runner complete (`runManualDeliveryPipeline`)
- Manual delivery foundation verification complete (`verify-manual-delivery-foundation`)
- **No UI send button**
- **No scheduled execution**
- **No mark-as-sent automation**
- **No `app.js` execution wiring**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-manual-delivery-foundation` — full manual delivery stack at service level

**Release candidate:** **v6.0.0-alpha.8**

### Phase 32 constraints

- Documentation and version display only — no app behaviour changes
- No UI send button, scheduled execution, or mark-as-sent automation
- No `app.js` execution wiring

---

**Constraints (Phase 31):** Verification orchestrator only. Runs delivery pipeline foundation and manual delivery runner checks. No app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Next slice after Phase 31:** V6 Phase 32 — Manual delivery foundation release readiness.

---

## Phase 31 — Manual delivery foundation verification

**Scope:** `scripts/verify-manual-delivery-foundation.mjs` orchestrator. Runs in order:

1. `npm run verify-delivery-pipeline-foundation`
2. `npm run verify-manual-delivery-runner`

Stops on first failure. Prints `V6 manual delivery foundation verification: OK` on success.

### Phase 31 deliverables

| Item | Location |
|------|----------|
| Manual delivery foundation orchestrator | `scripts/verify-manual-delivery-foundation.mjs` |

### Phase 31 constraints

- Verification orchestrator and documentation only
- No app behaviour changes, UI send button, or scheduled execution
- No mark-as-sent automation

---

## Phase 30 — Manual delivery pipeline runner

**Scope:** `runManualDeliveryPipeline({ queueItems, provider, db, organisationId, automationRunId, organisationName, asOfDate, now })` in `manual-delivery-runner.js`. Chains `buildReminderDeliveryRecords` → `runDeliveryPipeline`. First manually invoked end-to-end execution path — **not wired into `app.js`, UI, or scheduled jobs.**

**Script:** `scripts/verify-manual-delivery-runner.mjs`

`npm run verify-manual-delivery-runner` verifies:

1. Delivery records are created from queue items
2. Delivery pipeline is invoked
3. Execution and persistence summaries are returned
4. Input queue items are not mutated
5. No scheduler, `app.js`, or mark-as-sent hooks

### Phase 30 deliverables

| Item | Location |
|------|----------|
| Manual delivery runner | `js/app/automation/manual-delivery-runner.js` |
| Runner verification | `scripts/verify-manual-delivery-runner.mjs` |

### Phase 30 constraints

- Manual runner service and verification only
- No scheduler, recurring automation, or automatic delivery
- No `app.js` wiring, UI send button, or mark-as-sent automation

---

**Constraints (Phase 29):** Documentation and version bump only. Delivery pipeline stack complete at service level. No UI send button, scheduled execution, mark-as-sent automation, or `app.js` pipeline wiring.

**Next slice after Phase 29:** V6 Phase 30 — Manual delivery pipeline runner.

---

## Phase 29 — Delivery pipeline foundation release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.7`), and release-readiness gate for the service-level delivery pipeline stack. No application logic changes.

**Release-readiness note (v6.0.0-alpha.7):**

- V6 Phases 1–29 complete
- Delivery worker complete (`executeReminderDeliveries`)
- Persistence adapter complete (`buildDeliveryLogPayloads`)
- Persistence service complete (`persistDeliveryLogPayloads`)
- Delivery pipeline service complete (`runDeliveryPipeline`)
- Pipeline foundation verification complete (`verify-delivery-pipeline-foundation`)
- **No UI send button**
- **No scheduled execution**
- **No mark-as-sent automation**
- **No `app.js` pipeline wiring**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-delivery-pipeline-foundation` — full delivery pipeline stack at service level

**Release candidate:** **v6.0.0-alpha.7**

### Phase 29 constraints

- Documentation and version display only — no app behaviour changes
- No UI send button, scheduled execution, or mark-as-sent automation
- No `app.js` pipeline wiring

---

**Constraints (Phase 28):** Verification orchestrator only. Runs Resend provider foundation and delivery pipeline stack checks end-to-end at service level. No app behaviour changes, UI send button, scheduled execution, or mark-as-sent automation.

**Next slice after Phase 28:** V6 Phase 29 — Delivery pipeline foundation release readiness.

---

## Phase 28 — Delivery pipeline foundation verification

**Scope:** `scripts/verify-delivery-pipeline-foundation.mjs` orchestrator. Runs in order:

1. `npm run verify-browser-resend-provider-foundation`
2. `npm run verify-delivery-worker`
3. `npm run verify-delivery-worker-persistence`
4. `npm run verify-delivery-log-persistence-service`
5. `npm run verify-delivery-pipeline-service`
6. `npm run verify-delivery-operations-log-ui`

Stops on first failure. Prints `V6 delivery pipeline foundation verification: OK` on success.

### Phase 28 deliverables

| Item | Location |
|------|----------|
| Foundation verification orchestrator | `scripts/verify-delivery-pipeline-foundation.mjs` |

### Phase 28 constraints

- Verification orchestrator and documentation only
- No app behaviour changes, UI send button, or scheduled execution
- No mark-as-sent automation

---

**Constraints (Phase 27):** Service composition only. `runDeliveryPipeline` chains execution, payload mapping, and persistence. No `app.js` wiring, UI controls, scheduled jobs, or mark-as-sent automation.

**Next slice after Phase 27:** V6 Phase 28 — Delivery pipeline foundation verification.

---

## Phase 27 — Delivery pipeline service

**Scope:** `runDeliveryPipeline({ records, provider, db, organisationId, automationRunId, now })` in `delivery-pipeline-service.js`. Chains `executeReminderDeliveries` → `buildDeliveryLogPayloads` → `persistDeliveryLogPayloads`. **Not wired into `app.js`, UI, automation runs, or scheduled jobs.**

**Script:** `scripts/verify-delivery-pipeline-service.mjs`

`npm run verify-delivery-pipeline-service` verifies:

1. Execution worker, payload builder, and persistence service are composed in order
2. Returned `executionSummary` and `persistenceSummary` are correct
3. Partial persistence failures are surfaced in `persistenceResults`
4. Input records not mutated
5. No `app.js`/UI/schedule/mark-as-sent hooks

### Phase 27 deliverables

| Item | Location |
|------|----------|
| Pipeline service | `js/app/automation/delivery-pipeline-service.js` |
| Pipeline verification | `scripts/verify-delivery-pipeline-service.mjs` |

### Phase 27 constraints

- Service composition module and verification only
- No `app.js` wiring, UI buttons, or scheduled jobs
- No mark-as-sent automation or compliance/action/history mutation

---

**Constraints (Phase 26):** Persistence service only. `persistDeliveryLogPayloads` via `db.createReminderDeliveryLog` → `create_reminder_delivery_log` RPC. No provider calls, sending, `app.js` wiring, or mark-as-sent automation.

**Next slice after Phase 26:** V6 Phase 27 — Delivery pipeline service.

---

## Phase 26 — Delivery log persistence service

**Scope:** `persistDeliveryLogPayloads({ db, payloads })` in `delivery-log-persistence-service.js`. Calls `db.createReminderDeliveryLog(payload)` once per payload; continues on partial failure. Repository method `CloudAutomationStore.createReminderDeliveryLog` uses existing `create_reminder_delivery_log` RPC. **Not wired into `app.js`, UI, automation runs, or scheduled jobs.**

**Script:** `scripts/verify-delivery-log-persistence-service.mjs`

`npm run verify-delivery-log-persistence-service` verifies:

1. `createReminderDeliveryLog` called once per payload
2. Success summary counts (`total`, `persisted`, `failed`)
3. Partial failure continues processing and captures error messages
4. Input payloads not mutated
5. No provider/send/`app.js`/mark-as-sent hooks

### Phase 26 deliverables

| Item | Location |
|------|----------|
| Persistence service | `js/app/automation/delivery-log-persistence-service.js` |
| Repository RPC method | `js/data/cloud-automation-store.js` — `createReminderDeliveryLog` |
| Service verification | `scripts/verify-delivery-log-persistence-service.mjs` |

### Phase 26 constraints

- Persistence service and repository method only
- No provider calls, sending, or `app.js` wiring
- No mark-as-sent automation or compliance/action/history mutation

---

**Constraints (Phase 25):** Persistence mapping only. `buildDeliveryLogPayloads` maps records to `create_reminder_delivery_log` RPC payloads. No provider calls, RPC execution, database writes, `app.js` wiring, or mark-as-sent automation.

**Next slice after Phase 25:** V6 Phase 26 — Delivery log persistence service.

---

## Phase 25 — Delivery worker persistence adapter

**Scope:** `buildDeliveryLogPayloads({ records, organisationId, automationRunId })` in `delivery-worker-persistence.js`. Maps delivery worker records to `create_reminder_delivery_log` RPC payloads. **Does not call RPCs, write to the database, or wire into `app.js`.**

**Script:** `scripts/verify-delivery-worker-persistence.mjs`

`npm run verify-delivery-worker-persistence` verifies:

1. Payloads use `create_reminder_delivery_log` parameter names (`p_organisation_id`, `p_delivery_status`, lifecycle timestamps, `p_metadata`, etc.)
2. Delivered, failed, and prepared records map field values correctly
3. Metadata preserves `providerMessageId`, `provider`, `failureType`, builder context, and `statusHistory`
4. Input records not mutated
5. No database/RPC/provider/send/`app.js` wiring or mark-as-sent hooks

### Phase 25 deliverables

| Item | Location |
|------|----------|
| Persistence adapter | `js/app/automation/delivery-worker-persistence.js` |
| Persistence verification | `scripts/verify-delivery-worker-persistence.mjs` |

### Phase 25 constraints

- Persistence mapping module and verification only
- No provider calls, RPC execution, or database writes
- No `app.js` wiring, UI buttons, or mark-as-sent automation

---

**Constraints (Phase 24):** Execution engine only. In-memory `executeReminderDeliveries` with injected provider. No `app.js` wiring, UI buttons, automatic scheduling, database writes, RPC calls, or mark-as-sent automation.

**Next slice after Phase 24:** V6 Phase 25 — Delivery worker persistence adapter.

---

## Phase 24 — Worker delivery execution engine

**Scope:** In-memory execution engine `executeReminderDeliveries({ records, provider, transitionRecord, now })` in `delivery-worker.js`. Processes prepared records through an injected provider using `transitionReminderDeliveryRecord`. **Not wired into `app.js`, UI, automation runs, or scheduled jobs.**

**Script:** `scripts/verify-delivery-worker.mjs`

`npm run verify-delivery-worker` verifies:

1. Delivered path (`prepared` → `sending` → `delivered`)
2. Provider failed path (`prepared` → `sending` → `failed`)
3. Skipped records (delivered, cancelled, `failed` + `missing_recipient_email`, non-prepared)
4. Summary counts (`total`, `attempted`, `delivered`, `failed`, `skipped`)
5. Input records not mutated
6. No database/RPC/`app.js` wiring or mark-as-sent hooks

### Phase 24 deliverables

| Item | Location |
|------|----------|
| Delivery execution engine | `js/app/automation/delivery-worker.js` |
| Engine verification | `scripts/verify-delivery-worker.mjs` |

### Phase 24 constraints

- Execution engine module and verification only
- No `app.js` wiring, UI buttons, or automatic scheduling
- No database writes, RPC calls, or mark-as-sent automation

---

**Constraints (Phase 23):** Documentation and version bump only. Delivery Operations Log UI complete. No send/retry/execute controls, mark-as-sent automation, automatic delivery execution, or compliance/action/history mutation.

**Next slice after Phase 23:** V6 Phase 24 — Worker delivery execution engine.

---

## Phase 23 — Delivery Operations Log release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.6`), and release-readiness gate for the read-only Delivery Operations Log slice. No application logic changes.

**Release-readiness note (v6.0.0-alpha.6):**

- V6 Phases 1–23 complete
- Delivery Operations Log UI complete (read-only audit view, summary counts, expandable detail panel)
- CSV export complete (`buildDeliveryOperationsLogExportCsv`)
- Loads via `get_reminder_delivery_logs` RPC (read-only)
- **No send/retry/execute controls**
- **No mark-as-sent automation**
- **No automatic delivery execution**
- **No compliance/action/history mutation**

**Release verification (required before tag):**

- `npm run build` — rebuild `app.bundle.js` after version bump
- `npm run verify-resend-provider-foundation` — Resend provider foundation still safe
- `npm run verify-delivery-operations-log-ui` — read-only audit UI and CSV export; no execution hooks

**Release candidate:** **v6.0.0-alpha.6**

### Phase 23 constraints

- Documentation and version display only — no app behaviour changes
- No send/retry/execute controls, mark-as-sent automation, or automatic delivery execution
- No compliance/action/history mutation

---

**Constraints (Phase 22):** Read-only audit UI and CSV export only. No send button, delivery execution, mark-as-sent automation, or provider `sendReminder` calls.

**Next slice after Phase 22:** V6 Phase 23 — Delivery Operations Log release readiness.

---

## Phase 22 — Delivery Operations Log UI + export

**Scope:** Read-only UI for `reminder_delivery_logs` with summary counts, expandable detail panel, and CSV export. **No send button, delivery execution, mark-as-sent automation, or provider calls.**

**Script:** `scripts/verify-delivery-operations-log-ui.mjs`

`npm run verify-delivery-operations-log-ui` verifies:

1. Delivery Operations Log section in `index.html`
2. Summary counts (total, delivered, failed, prepared/sending/cancelled)
3. Expandable detail panel with `textContent` for body and metadata
4. CSV export button and export module
5. No send/retry/execute/mark-sent hooks; app does not call `provider.sendReminder`

### Phase 22 deliverables

| Item | Location |
|------|----------|
| Delivery log mapper | `js/data/reminder-delivery-logs.js` |
| UI helpers | `js/app/automation/delivery-operations-log-ui.js` |
| CSV export | `js/app/automation/delivery-operations-log-export.js` |
| Cloud load | `js/data/cloud-automation-store.js` (`loadReminderDeliveryLogs`) |
| UI verification | `scripts/verify-delivery-operations-log-ui.mjs` |

### Phase 22 constraints

- Read-only audit UI — no delivery execution from browser
- No send button, retry button, or mark-as-sent automation
- No `sendReminder` or provider network calls from `app.js`

---

**Constraints (Phase 21):** Documentation and version bump only. Isolated Resend provider complete. No `app.js` wiring for delivery execution, UI send button, mark-as-sent automation, or compliance/action/history mutation.

**Next slice after Phase 21:** V6 Phase 22 — Delivery Operations Log UI + export.

---

## Phase 21 — Resend provider release readiness

**Scope:** Documentation, version bump (`v6.0.0-alpha.5`), and release-readiness gate for the isolated Resend provider slice. No application logic changes.

**Documentation:** [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md#phase-21--resend-provider-release-readiness)

**Release-readiness note (v6.0.0-alpha.5):**

- V6 Phases 1–21 complete
- Isolated Resend provider complete (`createResendEmailProvider` with injected `fetchImpl` only)
- Resend provider foundation verification orchestrator complete (`npm run verify-resend-provider-foundation`)
- Disabled-by-default provider mode
- No `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation
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

**Constraints (Phase 20):** Verification orchestration only. No `app.js` wiring, UI send button, automatic delivery execution, mark-as-sent automation, or compliance/action/history mutation.

**Next slice after Phase 20:** V6 Phase 21 — Resend provider release readiness.

---

## Phase 20 — Resend provider foundation verification orchestrator

**Scope:** One verification command for provider skeleton foundation plus isolated Resend implementation, confirming it is still not wired into app execution. **Verification only** — no app behaviour changes.

**Documentation:** [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md#phase-20--resend-provider-foundation-verification-orchestrator)

**Script:** `scripts/verify-browser-resend-provider-foundation.mjs`

`npm run verify-browser-resend-provider-foundation` runs verification scripts in order:

1. `verify-email-provider-skeleton-foundation` — phases 12 + 14–15 orchestrator
2. `verify-resend-provider-plan` — Resend plan documentation and isolated module checks
3. `verify-resend-provider` — Resend provider with mocked `fetchImpl`

Stops on first failure. Prints section headings. Final success: `V6 Resend provider foundation verification: OK`

### Phase 20 deliverables

| Item | Location |
|------|----------|
| Resend foundation orchestrator | `scripts/verify-browser-resend-provider-foundation.mjs` |
| Architecture cross-reference | This document § Phase 20 |

### Phase 20 constraints

- Verification orchestration only — no app behaviour changes
- No `app.js` wiring, UI send button, automatic delivery execution, or mark-as-sent automation
- No compliance/action/history mutation

---

**Constraints (Phase 19):** Provider module only. Resend network implementation with injected `fetchImpl`. No `app.js` wiring, production automation path, mark-as-sent automation, or compliance/action/history mutation.

**Next slice after Phase 19:** V6 Phase 20 — Resend provider foundation verification orchestrator.

---

## Phase 19 — Resend network implementation

**Scope:** Implement `createResendEmailProvider` with injected `fetchImpl` for `POST https://api.resend.com/emails`. **Provider module only** — no `app.js` wiring, send button, mark-as-sent automation, or automatic delivery execution.

**Documentation:** [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md#phase-19--resend-network-implementation)

**Script:** `scripts/verify-resend-provider.mjs`

`npm run verify-resend-provider` verifies:

1. Valid config `healthCheck()` returns `ok` / `resend` (no network)
2. Invalid/disabled config blocks `sendReminder()`
3. Test mode recipient redirect and `[TEST]` subject prefix
4. Production mode uses real recipient
5. 2xx → `delivered`; transient/permanent HTTP status mapping
6. No global `fetch(` — `fetchImpl` injection only
7. `app.js` not wired; no mark-sent/compliance/action/history mutation hooks

### Phase 19 deliverables

| Item | Location |
|------|----------|
| Resend provider adapter | `js/app/automation/providers/resend-provider.js` |
| Provider verification | `scripts/verify-resend-provider.mjs` |
| Architecture cross-reference | This document § Phase 19 |

### Phase 19 constraints

- Provider module and verification only — no app behaviour changes
- Injected `fetchImpl` only — no global `fetch`
- No production automation path, mark-as-sent automation, or compliance/action/history mutation

---

**Constraints (Phase 18):** Documentation and version bump only. Resend plan complete. No network implementation, API key usage, production delivery, mark-as-sent automation, or app wiring.

**Next slice after Phase 18:** V6 Phase 19 — Resend network implementation in `createResendEmailProvider`.

---

## Documentation deliverables

| Document | When |
|----------|------|
| `docs/v6-delivery-architecture.md` | V6 Phase 1 — this document |
| `docs/v6-edge-delivery-function.md` | V6 Phase 36 — Edge Function `send-reminder-deliveries` contract |
| `docs/v6-email-provider-configuration.md` | V6 Phase 10 — provider configuration architecture |
| `docs/v6-delivery-schema.md` | V6 Phase 3+ — migrations and RPC reference (planned) |
| `docs/v6-release-notes.md` | v6.0.0 GA (planned) |
