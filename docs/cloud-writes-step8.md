# Phase 2 Step 8 — Cloud Action Status (open ↔ completed)

Action **Mark complete** and **Reopen** persistence via Postgres RPC. No `CloudComplianceStore.save()`.

## Scope

| Allowed | Not in Step 8 |
|---------|----------------|
| `open` → `completed` | `in_progress` transitions |
| `completed` → `open` | Edit / delete action |
| | Add default actions |
| | All other cloud mutations |

## Feature flags

Same as Step 7 — `CLOUD_WRITES_ENABLED` default `false`.

| Environment | How |
|-------------|-----|
| **Node verify / CI** | `CLOUD_WRITES_ENABLED=true` in process env |
| **Browser localhost** | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |
| **Browser staging** | Same query on staging hostnames (via `npm run sync-env`) |
| **Production** | **Never** use `?cloudWrites=1` |

`canMutateData()` stays **false** in cloud. Only `canSetActionStatus()` (flag + editor/admin) enables complete/reopen buttons.

## Migration

Apply `supabase/migrations/20260203000002_set_action_status_rpc.sql`:

```powershell
supabase db push
# or local reset
supabase db reset
```

Function: `public.set_action_status(p_action_id uuid, p_target_status text)`  
Targets: `open`, `completed` only.

## Verify

```powershell
npm run sync-env
npm run verify-read-only-guards
npm run verify-cloud-mark-reminder-sent
npm run verify-cloud-set-action-status
npm run verify-local-mode
npm run build
```

## Manual QA

See `docs/cloud-readonly-qa.md` section G.

## Rollback

1. Set `CLOUD_WRITES_ENABLED=false` (or remove from staging env).
2. Redeploy app tag from Step 7 if needed.
3. Optional DB: `DROP FUNCTION public.set_action_status(uuid, text);`
