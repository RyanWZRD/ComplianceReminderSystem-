# Cloud setup (v3.0.0 Alpha Phase 1)

Database schema, RLS, and seed data for Supabase. **No application code changes in Phase 1** — the app still runs in local mode by default.

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Docker Desktop (for `supabase start` locally)
- A staging Supabase project (EU/UK region recommended for production safeguarding data)

## Repository layout

```
supabase/
  config.toml
  migrations/          # Ordered SQL migrations (source of truth)
  seed.sql             # Synthetic alpha test data
docs/
  cloud-setup.md       # This file
  cloud-phase1-rls-checklist.md
.env.example           # Template for Phase 2+ env vars
```

The draft file `docs/schema-v3-draft.sql` is **superseded** by `supabase/migrations/`.

## Local Supabase (recommended for Phase 1 validation)

From the repository root:

```bash
supabase start
supabase db reset
```

`db reset` applies all migrations and runs `seed.sql`.

After start, note credentials:

```bash
supabase status
```

Use the **API URL** and **anon key** in `.env` (from `.env.example`).

Local Studio: http://127.0.0.1:54323

## Link to staging project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Run seed on staging via SQL Editor (paste `supabase/seed.sql`) or:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

Use the staging **connection string** from the Supabase dashboard (never commit it).

## Create test users (required for RLS tests)

Seed data does **not** create `auth.users` or `profiles`. After seeding:

1. Open Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Create three users (staging passwords only):

| Email | Role in `profiles` | Suggested display name |
|-------|-------------------|------------------------|
| `alpha-admin@example.com` | `admin` | Alpha Admin |
| `alpha-editor@example.com` | `editor` | Alpha Editor |
| `alpha-viewer@example.com` | `viewer` | Alpha Viewer |

3. Copy each user's **UUID** from the Auth dashboard.

4. Run in SQL Editor (replace profile UUIDs with auth user IDs):

```sql
insert into public.profiles (id, organisation_id, display_name, role)
values
  ('AUTH_USER_UUID_ADMIN', '11111111-1111-1111-1111-111111111111', 'Alpha Admin', 'admin'),
  ('AUTH_USER_UUID_EDITOR', '11111111-1111-1111-1111-111111111111', 'Alpha Editor', 'editor'),
  ('AUTH_USER_UUID_VIEWER', '11111111-1111-1111-1111-111111111111', 'Alpha Viewer', 'viewer');
```

Organisation ID `11111111-1111-1111-1111-111111111111` matches `seed.sql`.

## Seed data summary

| Entity | Count |
|--------|------:|
| Organisations | 1 |
| People | 5 |
| Compliance records | 6 |
| History entries | 2 |
| Evidence items | 2 (metadata only) |
| Actions | 3 (open, in_progress, completed) |
| Reminder settings | 1 |
| Deleted record snapshots | 1 |

All data is synthetic. No evidence files in Storage (alpha).

## Schema highlights (vs v2.9 local model)

- **actions**: `status`, `due_date`, `owner` (v2.8 parity)
- **history_entries**: `actor_display_name` for legacy import display names
- **evidence_items**: Storage metadata columns; no blob columns
- **deleted_record_snapshots**: JSON archive for deleted records

## Helper functions

| Function | Purpose |
|----------|---------|
| `current_organisation_id()` | Tenant scope for RLS |
| `current_user_role()` | admin / editor / viewer |
| `has_org_role(text[])` | Policy helper |
| `is_org_member()` | Authenticated profile exists |

## RLS summary

| Role | SELECT | Write operational data | reminder_settings |
|------|--------|------------------------|-------------------|
| viewer | Yes | No | Read only |
| editor | Yes | Yes | Read only |
| admin | Yes | Yes | Read + write |

`history_entries` are append-only (INSERT, no UPDATE/DELETE policies).

## Phase 1 validation

Complete `docs/cloud-phase1-rls-checklist.md` before starting Phase 2 (CloudComplianceStore).

## Phase 2 Step 1 — Supabase client (no app wiring)

Browser client modules exist; the app still uses `DATA_BACKEND = "local"` and does not import the client yet.

### Setup

1. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (from `supabase status` locally, or the staging project dashboard).
2. Generate gitignored config:

   ```bash
   npm run sync-env
   ```

3. Smoke test:

   ```bash
   npm run verify-supabase
   ```

### Files

| File | Committed |
|------|-----------|
| `js/data/supabase-env.example.js` | Yes (template) |
| `js/data/supabase-env.js` | No (generated from `.env`) |
| `js/data/supabase-client.js` | Yes (`getSupabaseClient`, `isSupabaseConfigured`) |

Never commit `.env`, `supabase-env.js`, or real anon keys.

## Phase 2 Step 2 — Supabase auth session (no app wiring)

- `js/auth/session.js` — public facade (`signInWithPassword`, `signOut`, profile-backed `SessionUser`)
- `js/auth/supabase-auth.js` — internal only; do not import from app code
- Default `AUTH_MODE` remains `local`; app behaviour unchanged

```bash
npm run verify-supabase-auth
```

Set `SUPABASE_TEST_EMAIL`, `SUPABASE_TEST_PASSWORD`, and optional `SUPABASE_TEST_ROLE` in `.env`.

## Phase 2 Step 3 — Cloud compliance load (no app wiring)

- `js/data/cloud-store.js` — `CloudComplianceStore.load()` (read-only)
- `js/data/cloud-mapper.js` — internal row mapping
- Loads: people, records, history, evidence, actions, deleted snapshots
- `repository.js` still uses local store until a later step

```bash
npm run verify-cloud-load
```

## Rollback

| Scenario | Action |
|----------|--------|
| Local bad migration | `supabase db reset` |
| Staging bad migration | Forward-fix migration file; avoid destructive drops |
| RLS lockout | Apply hotfix policy migration; emergency disable RLS on staging only |

## Not in Phase 1

- CloudComplianceStore / app wiring
- Login UI
- Evidence Storage buckets
- Backup JSON import tooling

## GDPR note

Do not load real DBS or safeguarding data until the full v3 GDPR checklist is complete. Use seed data and synthetic test users only.
