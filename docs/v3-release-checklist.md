# v3.0.0 release checklist

Use this checklist before tagging **`v3.0.0-rc1`** (release candidate) or **`v3.0.0`** (GA). Phase 3 cloud-write slices (P3-5 through P3-7A) are complete; P3-8 is hardening only.

## 1. Environment and config

- [ ] `.env` copied from `.env.example` (never commit `.env`)
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` point at **staging** (not production safeguarding data)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set for Node reset only (never in browser bundle)
- [ ] Alpha test users: `SUPABASE_TEST_*` emails/passwords match Auth dashboard
- [ ] `npm run sync-env` — `js/data/supabase-env.js` generated
- [ ] Committed defaults unchanged: `DATA_BACKEND=local`, `CLOUD_WRITES_ENABLED=false` in `js/data/config.js`

## 2. Database migrations

Confirm staging has **all** migrations applied, including RPC writes through:

| Migration | RPC / purpose |
|-----------|----------------|
| `20260203000001` | `mark_reminder_sent` |
| `20260203000002` | `set_action_status` |
| `20260203000003` | `renew_compliance` |
| `20260203000004` | `create_compliance_record` |
| `20260203000005` | `update_compliance_record` |
| `20260203000006` | `update_reminder_settings` |
| `20260203000007` | `update_compliance_record_notes` |
| `20260203000008` | `create_action` |
| `20260203000009` | `delete_action` |
| `20260203000010` | `set_action_in_progress` |
| `20260203000011` | `update_action` |
| `20260203000012` | `add_default_actions` |
| `20260203000013` | `create_evidence` |
| `20260203000014` | `delete_evidence` |
| `20260203000015` | `update_evidence` |
| `20260203000016` | `archive_compliance_record` |

```powershell
npx supabase migration list
supabase db push
```

- [ ] Seed + three Auth users with `profiles` for org `11111111-1111-1111-1111-111111111111` (`docs/cloud-setup.md`)

## 3. Automated verification (release gate)

From repository root:

```powershell
npm run build
npm run verify-read-only-guards
npm run verify:phase2
npm run verify-cloud-load
```

**`npm run verify:phase2`** is the single release gate. It runs sync-env, staging config, read-only guards, local mode, Supabase client/auth, **pre-reset**, all cloud RPC smoke tests (Phase 2 + Phase 3), **post-reset**, and build.

Canonical staging counts after reset:

| Entity | Count |
|--------|------:|
| People | 5 |
| Compliance records | 6 |
| History entries | 2 |
| Evidence items | 2 |
| Actions | 3 |
| Deleted record snapshots | 1 |

### Standalone scripts (also inside `verify:phase2`)

| Script | Why run alone |
|--------|----------------|
| `verify-read-only-guards` | Fast cloud-default check without Supabase RPC |
| `verify-cloud-load` | Quick load smoke after manual DB changes |
| `verify-local-mode` | Local-only regression (included in phase2) |
| Per-feature `verify-cloud-*` | Debug a single RPC failure |

All `verify-cloud-*` write smokes are wired into `verify:phase2`; no separate gate required.

## 4. Manual browser checks

With `npm run serve` and `npm run build`:

| URL | Expect |
|-----|--------|
| `http://127.0.0.1:8877/` | Local mode; full CRUD via `savePeople()` |
| `http://127.0.0.1:8877/?backend=cloud` | Sign-in; read-only; `canMutateData()` false |
| `http://127.0.0.1:8877/?backend=cloud&cloudWrites=1` | Editor: RPC writes work; viewer denied |

Complete `docs/cloud-readonly-qa.md` sections A–K for sign-off.

**Out of scope (must remain unavailable in cloud):**

- File storage / evidence upload
- Bulk archive or delete
- Restore / unarchive
- Direct browser table writes (`insert`/`update`/`delete` on Supabase tables)
- Backup JSON / CSV import into cloud

## 5. Rollback notes

| Scenario | Action |
|----------|--------|
| Bad app deploy | Redeploy previous tag; defaults stay read-only |
| Bad migration on staging | Forward-fix migration; avoid destructive drops |
| RLS lockout | Hotfix policy migration; emergency RLS disable on staging only |
| Staging data polluted | `node scripts/reset-alpha-staging-data.mjs` (service role) |

## 6. Tagging steps (RC)

After checklist passes:

```powershell
git status
npm run verify:phase2
git add -A
git commit -m "chore: v3.0.0-rc1 Phase 3 cloud-write hardening and release gate"
git tag -a v3.0.0-rc1 -m "v3.0.0-rc1 — Phase 3 cloud writes complete (RPC-only)"
git push origin HEAD
git push origin v3.0.0-rc1
```

Do not tag production until GDPR / operational sign-off for real safeguarding data.
