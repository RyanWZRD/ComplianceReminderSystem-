# Phase 3 Step 4 — Cloud compliance record notes (minimal v1)

Workspace **Save Notes** only. Edit-form `#edit-notes` stays disabled in cloud.

## Migration

Apply `supabase/migrations/20260203000007_update_compliance_record_notes_rpc.sql`:

```powershell
supabase db push
```

Function: `public.update_compliance_record_notes(p_record_id uuid, p_notes text)`

Returns: `updated`, `no_changes`, `not_found`, `rejected` (protected audit lines removed).

Server-side helper: `compliance_notes_preserves_protected_lines` — reminder-sent labels and renew audit sentinels must remain in new notes.

## Feature flags

Same as Phase 2 limited writes — `CLOUD_WRITES_ENABLED` default `false`.

`canUpdateComplianceRecordNotes()` — editor/admin when flag on. `canMutateData()` stays false in cloud.

## Verify

```powershell
npm run sync-env
npm run verify-cloud-update-compliance-record-notes
npm run verify:phase2
```

Smoke: editor update + reload + `no_changes`; viewer denied. Uses seed record Taylor Warden `33333333-3333-3333-3333-333333333304`.

Post-run reset restores seed notes via `reset-alpha-staging-data.mjs` (no script changes).

## Manual QA

- `?backend=cloud&cloudWrites=1` — workspace notes save persists after refresh
- Edit form notes field still disabled
- Viewer cannot save notes
