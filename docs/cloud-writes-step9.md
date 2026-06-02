# Phase 2 Step 9 — Cloud Renew Compliance

Renew compliance (expiry date + audit notes + history) via Postgres RPC. No `CloudComplianceStore.save()`.

## Scope

| Allowed | Not in Step 9 |
|---------|----------------|
| Renew modal — suggested date (active cycle) | Edit form expiry |
| Renew modal — custom date (today or later, Europe/London) | `renewal_cycle` edits |
| Register + workspace **Renew** | Bulk renew |
| | All other cloud mutations |

Custom date rules: valid ISO date, **today or later** (London). Does **not** need to be after current expiry.

## Feature flags

Same as Steps 7–8 — `CLOUD_WRITES_ENABLED` default `false`.

| Environment | How |
|-------------|-----|
| **Node verify / CI** | `CLOUD_WRITES_ENABLED=true` in process env |
| **Browser localhost** | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |
| **Browser staging** | Same query on staging hostnames |
| **Production** | **Never** use `?cloudWrites=1` |

`canMutateData()` stays **false** in cloud. Only `canRenewCompliance()` (flag + editor/admin) enables renew controls.

## Migration

Apply `supabase/migrations/20260203000003_renew_compliance_rpc.sql`:

```powershell
supabase db push
# or local reset
supabase db reset
```

Function: `public.renew_compliance(p_record_id uuid, p_renewal_mode text, p_new_expiry_date date default null)`  
Modes: `suggested` (server computes expiry from cycle), `custom` (requires date ≥ today London).

## Verify

```powershell
npm run sync-env
npm run verify-read-only-guards
npm run verify-cloud-mark-reminder-sent
npm run verify-cloud-set-action-status
npm run verify-cloud-renew-compliance
npm run verify-local-mode
npm run build
```

## Manual QA

See `docs/cloud-readonly-qa.md` section H.

## Rollback

1. Set `CLOUD_WRITES_ENABLED=false` (or remove from staging env).
2. Redeploy app tag from Step 8 if needed.
3. Optional DB: `DROP FUNCTION public.renew_compliance(uuid, text, date);`
