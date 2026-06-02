# Phase 2 Step 12 — Hardening and release readiness

Step 12 closes Phase 2 without new features, RPCs, or migrations. It adds a single verify entry point, synchronises version strings, and consolidates documentation.

## Scope

| In Step 12 | Out of scope (Phase 3+) |
|------------|-------------------------|
| `npm run verify:phase2` | Notes editing in cloud |
| Documentation and QA checklist updates | Evidence uploads |
| `APP_VERSION` / `index.html` cache-bust sync | Delete / archive |
| Phase 2 completion runbook and release notes | CSV / backup import |
| | Reminder settings writes |
| | Additional action CRUD in cloud |
| | `CloudComplianceStore.save()` |

## Invariants (unchanged)

| Setting | Committed default |
|---------|-------------------|
| `DATA_BACKEND` | `local` |
| `CLOUD_WRITES_ENABLED` | `false` |
| `canMutateData()` in cloud | `false` |

Limited cloud writes (Steps 7–11) still require `?cloudWrites=1` on localhost or `STAGING_APP_HOSTNAMES` only, or `CLOUD_WRITES_ENABLED=true` in Node verify scripts.

## Verify

```powershell
npm run verify:phase2
```

See `docs/cloud-phase2-completion.md` for the full workflow, manual QA, and sign-off.

## Manual QA

`docs/cloud-readonly-qa.md` — sections A–K.

## Rollback

Same as Step 11: redeploy tag `v3.0.0-alpha-phase2-step11` or earlier; keep `CLOUD_WRITES_ENABLED` false; no schema rollback required for doc-only Step 12.
