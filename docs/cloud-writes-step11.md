# Phase 2 Step 11 — Cloud Edit Compliance Record

Update person name/role and compliance record fields via Postgres RPC. **Notes are not modified** (audit lines from mark-sent / renew are preserved).

## Scope

| Allowed | Not in Step 11 |
|---------|----------------|
| Edit form — name, role, compliance type, expiry, renewal cycle | Notes editing (edit form or workspace) |
| Table **Edit** + workspace **Edit** (opens form) | Delete / archive |
| | CSV import |
| | Evidence |
| | Reminder settings |
| | Action CRUD |
| | All other cloud mutations |

## Feature flags

Same as Steps 7–10 — `CLOUD_WRITES_ENABLED` default `false`.

| Environment | How |
|-------------|-----|
| **Node verify / CI** | `CLOUD_WRITES_ENABLED=true` in process env |
| **Browser localhost** | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |
| **Browser staging** | Same query on staging hostnames |
| **Production** | **Never** use `?cloudWrites=1` |

`canMutateData()` stays **false** in cloud. Only `canEditComplianceRecord()` (flag + editor/admin) enables the edit form (notes field stays disabled in cloud).

## Migration

Apply `supabase/migrations/20260203000005_update_compliance_record_rpc.sql`:

```powershell
supabase db push
# or local reset
supabase db reset
```

Function: `public.update_compliance_record(p_person_id, p_record_id, p_name, p_role, p_compliance_type, p_expiry_date, p_renewal_cycle)`

Returns: `updated`, `no_changes`, `not_found`, `validation_error`, `name_conflict`.

## Verify

```powershell
npm run sync-env
npm run verify-read-only-guards
npm run verify-cloud-mark-reminder-sent
npm run verify-cloud-set-action-status
npm run verify-cloud-renew-compliance
npm run verify-cloud-create-compliance-record
npm run verify-cloud-edit-compliance-record
npm run verify-local-mode
npm run build
```

## Manual QA

See `docs/cloud-readonly-qa.md` section J.

## Rollback

1. Set `CLOUD_WRITES_ENABLED=false` (or remove from staging env).
2. Redeploy app tag from Step 10 if needed.
3. Optional DB: `DROP FUNCTION public.update_compliance_record(uuid, uuid, text, text, text, date, text);` and `DROP FUNCTION public.renewal_cycle_label(text);`

Edits made while enabled remain valid data — no schema rollback required.
