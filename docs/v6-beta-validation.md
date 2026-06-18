# V6.1 Phase 1 — Beta Validation Checklist

Validate the **complete manual delivery workflow** in a controlled staging environment **before** implementing mark-as-sent automation.

**Baseline:** **v6.0.0-beta.1** (V6 Phases 1–35 complete)  
**Scope:** Validation and sign-off only — **no new features, schema changes, RPC changes, or UI changes** unless a bug is found during testing.

**Related docs:**

- [`docs/v6-delivery-architecture.md`](v6-delivery-architecture.md) — delivery domain model and manual delivery phases
- [`docs/v6-email-provider-configuration.md`](v6-email-provider-configuration.md) — provider env vars and test/production gates
- [`docs/staging-deployment.md`](staging-deployment.md) — staging host and Supabase setup
- [`docs/cloud-readonly-qa.md`](cloud-readonly-qa.md) — cloud role QA patterns

---

## Constraints (V6.1 Phase 1)

| Rule | Detail |
|------|--------|
| No new features | Exercise existing manual delivery stack only |
| No schema changes | Use current `reminder_delivery_logs` migration |
| No RPC changes | Use current delivery log create/read RPCs |
| No UI changes | Unless a bug is found and fixed in a separate slice |
| No mark-as-sent automation | Delivery must not auto-mark reminders sent |
| No compliance/history mutation | Register rows and history entries unchanged by delivery |

---

## Automated gate

Run from the repository root:

```powershell
npm run verify-beta-validation-checklist
```

This verifies the checklist document is complete and runs the automated verification scripts mapped to each test area below. **No feature code changes required** for this phase.

---

## Prerequisites

### Local / CI automated checks

```powershell
npm run build
npm run verify-manual-delivery-e2e-foundation
npm run verify-beta-validation-checklist
```

### Staging environment (manual sign-off)

| Item | Requirement |
|------|-------------|
| Supabase project | Staging project migrated through V6 delivery log RPCs |
| App host | Static deploy with `?backend=cloud&cloudWrites=1` on an allowed hostname |
| Test accounts | `alpha-admin@example.com`, `alpha-editor@example.com`, `alpha-viewer@example.com` |
| Email provider | Resend configured in `js/data/email-provider-env.js` (never commit API keys) |
| Test mode | `EMAIL_MODE=test`, `EMAIL_PROVIDER_ENABLED=true`, `EMAIL_TEST_REDIRECT_TO` set to a controlled inbox |
| Secrets | Resend API key supplied via env only — not in git |

```powershell
npm run sync-env
npm run verify-staging-config
```

---

## Test execution summary

| # | Area | Automated verify | Manual staging |
|---|------|:----------------:|:--------------:|
| 1 | Queue generation | ✅ | Optional spot-check |
| 2 | Template generation | ✅ | Optional spot-check |
| 3 | Manual delivery UI | ✅ | Required |
| 4 | Test-mode delivery | ✅ | Required |
| 5 | Real Resend send | Partial | Required |
| 6 | Missing email | ✅ | Optional spot-check |
| 7 | Invalid email | ✅ | Optional spot-check |
| 8 | CSV export | ✅ | Optional spot-check |
| 9 | Permission checks | ✅ | Required |
| 10 | Safety checks | ✅ | Required |

---

## 1. Queue generation

**Goal:** Reminder queue preview count matches expected dry-run candidates.

### Automated verification

```powershell
npm run verify-reminder-queue
npm run verify-reminder-queue-ui
```

**Expected (fixture dataset):**

- `EXPECTED_REMINDER_QUEUE_SUMMARY.total` = **3** queued candidates
- `EXPECTED_REMINDER_QUEUE_SUMMARY.missingEmail` = **3**
- Window breakdown: 30-day = 1, 14-day = 1, expired = 1, 7-day = 0
- Queue items: `status: queued`, `source: dry_run_candidate`
- No send, mark-sent, or compliance mutation hooks in queue module

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 1.1 | Sign in as **admin** with `?backend=cloud&cloudWrites=1` | ☐ |
| 1.2 | **Reminder Queue Preview** card shows total queued count consistent with current register | ☐ |
| 1.3 | Missing-email count matches people in queue without email | ☐ |
| 1.4 | Per-window counts (30 / 14 / 7 / expired) match dashboard summary | ☐ |
| 1.5 | Safety note visible: *Preview only — no reminders are sent.* | ☐ |

---

## 2. Template generation

**Goal:** Preview template content and digest content are correct for queue items.

### Automated verification

```powershell
npm run verify-reminder-template-builder
npm run verify-reminder-template-preview
npm run verify-reminder-digest-builder
npm run verify-reminder-digest-preview-ui
```

**Expected:**

- Per-item template: valid `subject` and `bodyText` from `buildReminderEmailTemplate`
- Missing-email rows still produce template preview with warning
- Digest: `buildReminderDigest` returns summary counts and grouped follow-up list
- Empty queue produces useful “no reminders due” digest
- No delivery provider calls or mark-sent hooks

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 2.1 | Expand a queue row → **Preview template** shows subject and body | ☐ |
| 2.2 | Row with missing email shows missing-email warning | ☐ |
| 2.3 | **Digest preview** subject/body match queue summary counts | ☐ |
| 2.4 | **Copy digest** copies subject + body to clipboard | ☐ |
| 2.5 | Safety notes: *Template preview only* / *Digest preview only — no email is sent.* | ☐ |

---

## 3. Manual delivery UI

**Goal:** Manual delivery test surface is visible only for admin, hidden for editor/viewer, and disabled when provider disabled.

### Automated verification

```powershell
npm run verify-manual-delivery-ui
```

**Expected:**

- `#manual-delivery-test-section` hidden by default; visible only when `canRunManualDeliveryTest()` is true
- `canRunManualDeliveryTest()` requires cloud mode + `CLOUD_WRITES_ENABLED` + **admin** role
- Run button disabled when `!providerConfig.enabled`
- Confirmation dialog before run; invokes `runManualDeliveryPipeline`
- No scheduler, mark-sent, or history mutation hooks in manual delivery modules

### Manual staging check

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| 3.1 | **Manual Delivery Test** card visible | ☐ | ☐ | ☐ |
| 3.2 | Queue summary (total / missing email) populated | ☐ | — | — |
| 3.3 | Provider mode label shown (test / production / disabled) | ☐ | — | — |
| 3.4 | Run button **enabled** when provider enabled (admin only) | ☐ | — | — |
| 3.5 | Card **hidden** for non-admin | — | ☐ | ☐ |
| 3.6 | With provider disabled, run button **disabled** (admin) | ☐ | — | — |

---

## 4. Test-mode delivery

**Goal:** When provider mode = test, recipient redirected to `EMAIL_TEST_REDIRECT_TO` and `[TEST] subject prefix applied`.

### Automated verification

```powershell
npm run verify-resend-provider
```

**Expected (mocked `fetchImpl`):**

- `EMAIL_MODE=test` + valid config → Resend API called with `to[0]` = `testRedirectTo`
- Subject sent as `[TEST] <original subject>`
- Production mode does **not** redirect or prefix
- Disabled / invalid config blocks send without network call

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 4.1 | Staging env: `EMAIL_MODE=test`, `EMAIL_TEST_REDIRECT_TO` = controlled inbox | ☐ |
| 4.2 | Run manual delivery test as admin (confirm dialog) | ☐ |
| 4.3 | Email arrives at **redirect inbox**, not volunteer address | ☐ |
| 4.4 | Subject line starts with **`[TEST]`** | ☐ |
| 4.5 | Body content matches template preview for that row | ☐ |

---

## 5. Real Resend send

**Goal:** Successful delivery path: delivery log created and operations log updated after a real Resend send.

### Automated verification

```powershell
npm run verify-manual-delivery-runner
npm run verify-manual-delivery-foundation
npm run verify-delivery-log-persistence-service
npm run verify-delivery-operations-log-ui
```

**Expected (in-memory / mocked persistence):**

- `runManualDeliveryPipeline`: queue → records → pipeline → persistence summary
- Delivered records get `deliveryStatus: delivered` and provider message id
- Persistence service maps to `create_reminder_delivery_log` RPC shape
- Operations log UI loads logs read-only via `get_reminder_delivery_logs`

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 5.1 | Manual delivery run completes without UI crash | ☐ |
| 5.2 | Result summary shows attempted / delivered / failed / persisted counts | ☐ |
| 5.3 | **Delivery Operations Log** lists new row(s) with `delivered` status | ☐ |
| 5.4 | Expand log detail — recipient, subject, timestamps, provider message id present | ☐ |
| 5.5 | Resend dashboard shows matching send (test redirect address) | ☐ |

---

## 6. Missing email

**Goal:** Records without email are skipped/failed correctly; no crash.

### Automated verification

```powershell
npm run verify-reminder-delivery-record-builder
npm run verify-manual-delivery-runner
```

**Expected:**

- Missing-email queue items → delivery record with `deliveryStatus: failed`, `failureReason: missing_recipient_email`
- Template content still prepared on record
- Provider **not** called for missing-email records
- Pipeline completes; other prepared records still process
- Input queue items not mutated

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 6.1 | Queue includes at least one person with missing email | ☐ |
| 6.2 | Manual delivery run completes (no uncaught error) | ☐ |
| 6.3 | Result summary reflects skipped/failed missing-email count | ☐ |
| 6.4 | Operations log shows `failed` + `missing_recipient_email` where applicable | ☐ |
| 6.5 | No email sent for missing-email rows | ☐ |

---

## 7. Invalid email

**Goal:** Invalid recipient addresses fail gracefully; failure recorded correctly and operations log updated.

### Automated verification

```powershell
npm run verify-resend-provider
```

**Expected:**

- Resend HTTP **400 / 401 / 403 / 404 / 422** → `status: failed`, `failureType: permanent`
- Network / 5xx errors → `failureType: transient`
- Provider returns structured failure; pipeline persists failed delivery log
- No uncaught exception from provider adapter

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 7.1 | Seed or edit a test person with invalid email (e.g. `not-an-email`) | ☐ |
| 7.2 | Person appears in queue with email shown | ☐ |
| 7.3 | Manual delivery run completes without crash | ☐ |
| 7.4 | Operations log row: `failed` with provider/permanent failure reason | ☐ |
| 7.5 | Valid recipients in same run still deliver successfully | ☐ |

---

## 8. CSV export

**Goal:** Delivery logs export correctly from the operations log (CSV).

### Automated verification

```powershell
npm run verify-delivery-operations-log-ui
```

**Expected:**

- Export builds CSV with headers: delivery id, status, recipient, subject, sent/delivered timestamps, failure reason, etc.
- CSV escaping handles commas, quotes, and newlines
- Export filename includes organisation slug and date
- No send/retry/execute hooks in export path

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 8.1 | **Export delivery logs CSV** downloads a file after a delivery run | ☐ |
| 8.2 | CSV opens cleanly; headers match UI columns | ☐ |
| 8.3 | Latest delivered/failed rows appear in export | ☐ |
| 8.4 | Export disabled or empty-message when no logs (fresh org) | ☐ |

---

## 9. Permission checks

**Goal:** Only admin can run manual delivery; editor cannot run delivery and viewer cannot run delivery.

### Automated verification

```powershell
npm run verify-manual-delivery-ui
npm run verify-manual-delivery-e2e-foundation
```

**Expected:**

- `canRunManualDeliveryTest()` → `false` for editor/viewer (requires `canAdmin()`)
- `renderManualDeliveryTest` hides section when permission false
- `handleManualDeliveryTestRun` re-checks permission before execution
- E2E orchestrator static gate: admin + cloud writes on run handler

### Manual staging check

| # | Check | Admin | Editor | Viewer |
|---|--------|:-----:|:------:|:------:|
| 9.1 | Manual delivery card visible | ☐ | Hidden ☐ | Hidden ☐ |
| 9.2 | Cannot trigger run without card/button | — | ☐ | ☐ |
| 9.3 | Editor/viewer can still view queue preview (read-only) | — | ☐ | ☐ |
| 9.4 | Editor/viewer can view operations log (read-only) | — | ☐ | ☐ |

---

## 10. Safety checks

**Goal:** Delivery must not change compliance records, create history entries, or auto-mark reminders sent — no compliance records changed, no history entries created, no reminders auto-marked sent.

### Automated verification

```powershell
npm run verify-manual-delivery-e2e-foundation
npm run verify-manual-delivery-runner
```

**Expected:**

- Manual delivery modules contain **no** `markReminderSent`, `mark_reminder_sent`, `history_entries`, `add_default_actions`, scheduler hooks
- E2E orchestrator: no committed Resend API key in repo
- Pipeline runner: queue items immutable; no compliance RPC calls
- `verify-manual-delivery-ui` smoke: execution completes without mark-sent side effects

### Manual staging check

| # | Check | Pass |
|---|--------|:----:|
| 10.1 | Note compliance record `updated_at` / expiry before delivery run | ☐ |
| 10.2 | Run manual delivery for a queued reminder | ☐ |
| 10.3 | Compliance records **unchanged** (expiry, notes, email) | ☐ |
| 10.4 | Reminder **not** marked sent in register UI | ☐ |
| 10.5 | No new **history** entries attributable to delivery | ☐ |
| 10.6 | Queue preview still shows same rows as unsent (`sent: false`) | ☐ |

---

## Sign-off

| Role | Name | Date | Automated gate | Staging complete |
|------|------|------|:--------------:|:----------------:|
| Engineering | | | ☐ | ☐ |
| Safeguarding / product | | | ☐ | ☐ |

**Gate to proceed to V6 Phase 36 (mark-as-sent automation):**

- [ ] `npm run verify-beta-validation-checklist` passes
- [ ] Manual staging sections 3, 4, 5, 9, and 10 signed off
- [ ] No blocking bugs open against manual delivery workflow

---

## Phase 1 deliverables

| Item | Location |
|------|----------|
| Beta validation checklist | `docs/v6-beta-validation.md` (this document) |
| Checklist verification | `scripts/verify-beta-validation-checklist.mjs` |
| npm script | `npm run verify-beta-validation-checklist` |

**Next slice:** V6 Phase 36 — Mark-as-sent on confirmed delivery (policy-gated) — only after beta validation sign-off.
