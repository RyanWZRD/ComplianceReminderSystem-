# Release notes — v3.0.0 Alpha Phase 2

## Summary

Phase 2 adds **Supabase-backed cloud mode** alongside unchanged **local-first** default. Signed-in users load organisation-scoped compliance data. **Optional limited writes** (seven RPC-backed operations) are available only when explicitly enabled on localhost or configured staging hostnames — never by default in committed source.

## Version

- Application: `v3.0.0-alpha-phase2-step12` (Step 12 hardening)
- Recommended completion tag: `v3.0.0-alpha-phase2-complete`

## Defaults (unchanged)

| Flag | Default |
|------|---------|
| `DATA_BACKEND` | `local` |
| `CLOUD_WRITES_ENABLED` | `false` |
| `canMutateData()` in cloud | `false` |

Browser cloud: `?backend=cloud`. Browser limited writes: `?cloudWrites=1` on allowed hosts only.

## What shipped (Steps 4–11)

- Supabase login UI and session (`js/auth/`)
- Cloud load: people, records, history, evidence (read), actions, deleted snapshots (read)
- Read-only guards and role-based load parity (admin / editor / viewer)
- RPC writes when flag enabled:
  - Mark reminder sent
  - Mark action complete / reopen
  - Renew compliance
  - Create compliance record
  - Edit compliance record (notes column not updated in cloud)

Each successful RPC reloads cloud data; there is no `CloudComplianceStore.save()`.

## Database

Apply all migrations under `supabase/migrations/`, including Phase 2 RPC files:

- `20260203000001_mark_reminder_sent_rpc.sql`
- `20260203000002_set_action_status_rpc.sql`
- `20260203000003_renew_compliance_rpc.sql`
- `20260203000004_create_compliance_record_rpc.sql`
- `20260203000005_update_compliance_record_rpc.sql`

## Verification

```powershell
npm run verify:phase2
```

Manual QA: `docs/cloud-readonly-qa.md`. Full close-out: `docs/cloud-phase2-completion.md`.

## Not included (Phase 3)

- Notes editing in cloud
- Evidence file upload / delete
- Record delete / archive
- CSV or backup JSON import into cloud
- Reminder settings mutation
- Full action CRUD in cloud
- Bulk cloud writes
- Production-wide cloud writes by default

## Upgrade steps

1. `supabase db push` (staging)
2. `npm run sync-env`
3. `npm run verify:phase2`
4. `npm run build` and redeploy static assets (`index.html`, `app.bundle.js`, `styles.css`, `js/data/supabase-env.js`)

## Local mode

Opening `index.html` or `http://127.0.0.1:8877/` without `?backend=cloud` continues to use localStorage with full v2.x feature set.
