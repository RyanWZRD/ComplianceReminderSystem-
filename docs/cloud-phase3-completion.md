# Phase 3 completion — cloud writes (v3.0.0-rc1)

Phase 3 adds **RPC-only** cloud mutations behind `CLOUD_WRITES_ENABLED` (default `false`). `canMutateData()` remains **`false`** in cloud; local mode is unchanged.

## Cloud-write coverage (in scope)

| Area | Permission helper | RPC(s) |
|------|-------------------|--------|
| Mark reminder sent | `canMarkReminderSent()` | `mark_reminder_sent` |
| Action complete/reopen | `canSetActionStatus()` | `set_action_status` |
| Action create/delete/update/in-progress | `canMutateActions()` | `create_action`, `delete_action`, `update_action`, `set_action_in_progress`, `add_default_actions` (+ bulk via `create_action` loop) |
| Evidence metadata CRUD | `canMutateEvidence()` | `create_evidence`, `update_evidence`, `delete_evidence` |
| Renew compliance | `canRenewCompliance()` | `renew_compliance` |
| Add record | `canAddComplianceRecord()` | `create_compliance_record` |
| Edit record (not notes column) | `canEditComplianceRecord()` | `update_compliance_record` |
| Workspace notes | `canUpdateComplianceRecordNotes()` | `update_compliance_record_notes` |
| Archive/delete record | `canArchiveComplianceRecord()` | `archive_compliance_record` |
| Reminder settings | `canMutateReminderSettings()` | `update_reminder_settings` (admin only) |

Browser loads use **SELECT** on tables (`cloud-store.js`, `cloud-settings-store.js`, `profiles`); all mutations go through **`supabase.rpc()`**.

## Deliberately out of scope

- Supabase Storage / evidence file upload
- Bulk archive or delete
- Restore / unarchive from deleted snapshots
- `CloudComplianceStore.save()` / broad table sync
- Backup JSON or CSV import into cloud
- Direct browser `insert` / `update` / `delete` on operational tables

## Release verification

```powershell
npx supabase migration list
npm run build
npm run verify-read-only-guards
npm run verify:phase2
npm run verify-cloud-load
```

See `docs/v3-release-checklist.md` for full sign-off.

## Enable cloud writes (dev/staging only)

- Browser: `?backend=cloud&cloudWrites=1` on **localhost** or `STAGING_APP_HOSTNAMES` only
- Node smoke tests: `CLOUD_WRITES_ENABLED=true` per script
- Defaults: `DATA_BACKEND=local`, `CLOUD_WRITES_ENABLED=false`
