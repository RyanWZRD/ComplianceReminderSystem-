# Phase 2 Step 10 — Cloud Create Compliance Record

Add compliance records (with automatic find-or-create person) via Postgres RPC. No `CloudComplianceStore.save()`.

## Scope

| Allowed | Not in Step 10 |
|---------|----------------|
| Add Person form — new person + record | Edit person / record |
| Add Person form — existing person (case-insensitive name) | Delete / archive |
| Register **Add person** quick action | CSV import |
| | Evidence / notes editing |
| | Reminder settings |
| | Add / edit / delete actions |
| | All other cloud mutations |

## Feature flags

Same as Steps 7–9 — `CLOUD_WRITES_ENABLED` default `false`.

| Environment | How |
|-------------|-----|
| **Node verify / CI** | `CLOUD_WRITES_ENABLED=true` in process env |
| **Browser localhost** | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |
| **Browser staging** | Same query on staging hostnames |
| **Production** | **Never** use `?cloudWrites=1` |

`canMutateData()` stays **false** in cloud. Only `canAddComplianceRecord()` (flag + editor/admin) enables the Add Person form.

## Migration

Apply `supabase/migrations/20260203000004_create_compliance_record_rpc.sql`:

```powershell
supabase db push
# or local reset
supabase db reset
```

Function: `public.create_compliance_record(p_name, p_role, p_compliance_type, p_expiry_date, p_renewal_cycle default null)`

Returns: `created` with `person_id`, `record_id`, `is_new_person`; or `validation_error` for blank/invalid input.

## Verify

```powershell
npm run sync-env
npm run verify-read-only-guards
npm run verify-cloud-mark-reminder-sent
npm run verify-cloud-set-action-status
npm run verify-cloud-renew-compliance
npm run verify-cloud-create-compliance-record
npm run verify-local-mode
npm run build
```

## Manual QA

See `docs/cloud-readonly-qa.md` section I.

## Rollback

1. Set `CLOUD_WRITES_ENABLED=false` (or remove from staging env).
2. Redeploy app tag from Step 9 if needed.
3. Optional DB: `DROP FUNCTION public.create_compliance_record(text, text, text, date, text);`

Records created while enabled remain valid data — no schema rollback required.
