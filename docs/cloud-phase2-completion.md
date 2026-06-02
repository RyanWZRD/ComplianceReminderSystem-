# Phase 2 completion runbook

Canonical checklist to close **Phase 2** (cloud operational lifecycle, default-safe). No new RPCs or app behaviour changes in Step 12.

**Baseline after Step 11:** tag `v3.0.0-alpha-phase2-step11`  
**Step 12 target version:** `v3.0.0-alpha-phase2-step12`  
**Recommended completion tag:** `v3.0.0-alpha-phase2-complete` (after sign-off below)

## 1. Prerequisites

- [ ] `.env` from `.env.example` with staging `SUPABASE_URL`, `SUPABASE_ANON_KEY`, test user emails/passwords
- [ ] Staging Supabase: all migrations through `20260203000005_update_compliance_record_rpc.sql` applied (`supabase db push` or equivalent)
- [ ] Seed + three Auth users with `profiles` rows (`docs/cloud-setup.md`)
- [ ] Node.js and `npm install` completed

## 2. Automated verification (single command)

From repository root:

```powershell
npm run verify:phase2
```

This runs, in order:

1. `sync-env`
2. `verify-staging-config`
3. `verify-read-only-guards` — `canMutateData()` false; granular writes false without flag
4. `verify-local-mode`
5. `verify-supabase`
6. `verify-supabase-auth`
7. `verify-cloud-load`
8. `verify-cloud-role-load`
9. `verify-repository-cloud`
10. `verify-cloud-mark-reminder-sent`
11. `verify-cloud-set-action-status`
12. `verify-cloud-renew-compliance`
13. `verify-cloud-create-compliance-record`
14. `verify-cloud-edit-compliance-record`
15. `build`

**Tier 1 only** (no Supabase RPC tests): stop after `verify-local-mode` if you only need local regression.

## 3. Manual QA

Complete `docs/cloud-readonly-qa.md`:

| Section | Purpose |
|---------|---------|
| A | Local default mode |
| B | Cloud read-only (all roles, no `cloudWrites`) |
| C | Boot / login errors |
| D | Staging host (if deployed) |
| E | RLS SQL checklist (optional) |
| F–J | Limited writes with `?backend=cloud&cloudWrites=1` |
| K | Integrated editor pass + flag toggle |

Sign-off table at the end of the QA doc must be checked.

## 4. Staging deploy (optional)

`docs/staging-deployment.md` — static deploy with `npm run build` after verify.

| URL | Use |
|-----|-----|
| `/?backend=cloud` | Default cloud UX (read-only banner) |
| `/?backend=cloud&cloudWrites=1` | QA only on allowed hosts |

Never enable `?cloudWrites=1` on production domains.

## 5. Cloud capabilities delivered (Phase 2)

| Capability | Mechanism |
|------------|-----------|
| Login / load | Supabase Auth + `CloudComplianceStore.load()` |
| Mark reminder sent | RPC `mark_reminder_sent` |
| Action complete / reopen | RPC `set_action_status` |
| Renew compliance | RPC `renew_compliance` |
| Add compliance record | RPC `create_compliance_record` |
| Edit person / record fields | RPC `update_compliance_record` (notes not written) |

## 6. Explicitly deferred (Phase 3)

- Notes editing (workspace and cloud)
- Evidence uploads
- Delete / archive
- CSV import and backup import
- Reminder settings writes
- Action add / edit / delete / in-progress in cloud
- `CloudComplianceStore.save()` and broad sync

## 7. Approval checkpoint

Before tagging `v3.0.0-alpha-phase2-complete`:

| Evidence | Done |
|----------|:----:|
| `npm run verify:phase2` exit 0 | ☐ |
| QA doc A–C signed | ☐ |
| QA B (cloud read-only, three roles) | ☐ |
| QA F–J + K with `cloudWrites` (editor + viewer; admin mirrors editor) | ☐ |
| Committed `js/data/config.js` defaults unchanged | ☐ |
| Release notes reviewed (`docs/phase2-release-notes.md`) | ☐ |

Date: _______________  
Approved by: _______________

## 8. Rollback

| Layer | Action |
|-------|--------|
| Application | Checkout `v3.0.0-alpha-phase2-step11` (or last good tag), `npm run build`, redeploy static files |
| Cloud writes | Remove `?cloudWrites=1`; do not set `CLOUD_WRITES_ENABLED` in production |
| Database | Forward-fix migrations only; RPC `DROP` optional (data from writes remains valid) |
| Local users | Unaffected |

## Related docs

- `docs/cloud-writes-step7.md` … `docs/cloud-writes-step12.md`
- `docs/phase2-release-notes.md`
- `docs/cloud-readonly-qa.md`
- `docs/cloud-phase1-rls-checklist.md`
