# Phase 1 RLS validation checklist

Complete after migrations, seed, and test user profiles are created.  
Organisation ID for seed data: `11111111-1111-1111-1111-111111111111`

## 1. Schema inventory

Run in SQL Editor (as postgres / service role):

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;
```

Expected tables: `actions`, `compliance_records`, `deleted_record_snapshots`, `evidence_items`, `history_entries`, `organisations`, `people`, `profiles`, `reminder_settings`.

Verify v2.9 action columns:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'actions'
  and column_name in ('status', 'due_date', 'owner', 'completed', 'completed_at');
```

Verify history actor display name:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'history_entries'
  and column_name = 'actor_display_name';
```

## 2. Seed row counts

```sql
select 'people' as entity, count(*) from public.people
union all select 'compliance_records', count(*) from public.compliance_records
union all select 'actions', count(*) from public.actions
union all select 'evidence_items', count(*) from public.evidence_items
union all select 'history_entries', count(*) from public.history_entries;
```

Expected: people 5, compliance_records 6, actions 3, evidence_items 2, history_entries 2.

## 3. RLS enabled

```sql
select relname, relrowsecurity
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where nspname = 'public'
  and relkind = 'r'
  and relname in (
    'organisations', 'profiles', 'people', 'compliance_records',
    'history_entries', 'evidence_items', 'actions',
    'reminder_settings', 'deleted_record_snapshots'
  );
```

All `relrowsecurity` should be `true`.

## 4. Authenticated role tests

Use Supabase Dashboard → SQL Editor with **Role** set to `authenticated`, or sign in via REST with each test user's JWT.

Replace `YOUR_JWT` or use the dashboard impersonation feature.

### 4.1 Admin / editor / viewer — SELECT

As each role:

```sql
select count(*) from public.people;
select count(*) from public.compliance_records;
select count(*) from public.actions;
```

| Check | Pass |
|-------|------|
| Admin sees 5 people, 6 records | ☐ |
| Editor sees same counts | ☐ |
| Viewer sees same counts | ☐ |

### 4.2 Viewer — write denied

As **viewer**:

```sql
insert into public.people (organisation_id, name, role)
values ('11111111-1111-1111-1111-111111111111', 'RLS Test', 'Test');
```

| Check | Pass |
|-------|------|
| INSERT fails (permission denied or RLS violation) | ☐ |

### 4.3 Editor — write allowed

As **editor**:

```sql
insert into public.people (organisation_id, name, role)
values ('11111111-1111-1111-1111-111111111111', 'RLS Editor Test', 'Test');

-- Clean up
delete from public.people where name = 'RLS Editor Test';
```

| Check | Pass |
|-------|------|
| INSERT succeeds | ☐ |
| DELETE succeeds | ☐ |

### 4.4 Editor — reminder_settings denied

As **editor**:

```sql
update public.reminder_settings
set days_7 = false
where organisation_id = '11111111-1111-1111-1111-111111111111';
```

| Check | Pass |
|-------|------|
| UPDATE fails | ☐ |

### 4.5 Admin — reminder_settings allowed

As **admin**:

```sql
update public.reminder_settings
set days_7 = false
where organisation_id = '11111111-1111-1111-1111-111111111111';

-- Restore
update public.reminder_settings
set days_7 = true
where organisation_id = '11111111-1111-1111-1111-111111111111';
```

| Check | Pass |
|-------|------|
| UPDATE succeeds | ☐ |

### 4.6 History immutability

As **editor**:

```sql
update public.history_entries
set description = 'tampered'
where id = '44444444-4444-4444-4444-444444444401';

delete from public.history_entries
where id = '44444444-4444-4444-4444-444444444401';
```

| Check | Pass |
|-------|------|
| UPDATE fails | ☐ |
| DELETE fails | ☐ |

## 5. Anon access denied

As **anon** (no JWT):

```sql
select count(*) from public.people;
```

| Check | Pass |
|-------|------|
| Returns 0 rows or permission error (not 5) | ☐ |

## 6. Cross-organisation isolation (optional but recommended)

1. Insert a second organisation and profile for a separate test user.
2. Confirm user A cannot `select` rows where `organisation_id` is org B.

| Check | Pass |
|-------|------|
| Cross-org SELECT returns 0 rows | ☐ |

## 7. Storage

| Check | Pass |
|-------|------|
| No evidence Storage bucket configured for alpha | ☐ |

## Sign-off

| Item | Status |
|------|--------|
| Migrations applied | ☐ |
| Seed applied | ☐ |
| Three test profiles linked | ☐ |
| Checklist sections 4–5 pass | ☐ |
| Ready for Phase 2 | ☐ |

Date: _______________  
Validated by: _______________
