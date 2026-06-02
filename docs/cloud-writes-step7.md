# Phase 2 Step 7 — Cloud Mark Reminder Sent

Single-record **Mark Reminder Sent** persistence via Postgres RPC. No `CloudComplianceStore.save()`.

## Feature flags

| Flag | Default (git) | Purpose |
|------|---------------|---------|
| `DATA_BACKEND` | `local` | Cloud load when `cloud` |
| `CLOUD_WRITES_ENABLED` | `false` | Enables mark-sent RPC path |

### Enabling cloud writes

| Environment | How |
|-------------|-----|
| **Node verify / CI** | `CLOUD_WRITES_ENABLED=true` in process env |
| **Browser localhost** | `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` |
| **Browser staging** | Same query on hostnames listed in `.env` → `STAGING_APP_HOSTNAMES` (via `npm run sync-env`) |
| **Production** | **Never** use `?cloudWrites=1` — override is ignored on non-allowlisted hosts |

`canMutateData()` stays **false** in cloud. Only `canMarkReminderSent()` (flag + editor/admin) enables Mark Sent.

## Migration

Apply `supabase/migrations/20260203000001_mark_reminder_sent_rpc.sql`:

```powershell
supabase db push
# or local reset
supabase db reset
```

Function: `public.mark_reminder_sent(p_record_id uuid, p_reminder_type text)`  
Types: `30`, `14`, `7`, `expired`.

## Verify

```powershell
npm run sync-env
npm run verify-read-only-guards
npm run verify-cloud-mark-reminder-sent
npm run verify-local-mode
npm run build
```

## Manual QA

See `docs/cloud-readonly-qa.md` section F.

## Rollback

1. Set `CLOUD_WRITES_ENABLED=false` (or remove from staging env).
2. Redeploy app tag `v3.0.0-alpha-phase2-step6` if needed.
3. Optional DB: `DROP FUNCTION public.mark_reminder_sent(uuid, text);`
