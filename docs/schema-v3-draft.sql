-- Draft schema for v3.x cloud migration (Supabase/PostgreSQL)
-- SUPERSEDED: use supabase/migrations/ as the source of truth (v3.0.0 Alpha Phase 1).
-- Not used by v2.4.0 local storage mode.

create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references organisations (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table compliance_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  compliance_type text not null,
  expiry_date date not null,
  renewal_cycle text not null default 'manual',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table history_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  record_id uuid not null references compliance_records (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table evidence_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  record_id uuid not null references compliance_records (id) on delete cascade,
  name text not null,
  document_type text not null,
  notes text not null default '',
  file_path text,
  file_name text,
  added_date date not null,
  created_at timestamptz not null default now()
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  record_id uuid not null references compliance_records (id) on delete cascade,
  title text not null,
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table reminder_settings (
  organisation_id uuid primary key references organisations (id) on delete cascade,
  days_30 boolean not null default true,
  days_14 boolean not null default true,
  days_7 boolean not null default true,
  hide_sent_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row Level Security policies would scope every table by organisation_id
-- and restrict writes by profiles.role.
