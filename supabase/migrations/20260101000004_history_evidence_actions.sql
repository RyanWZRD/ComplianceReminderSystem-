-- v3.0.0 Alpha Phase 1: child tables (v2.9.x field parity)

create table public.history_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  record_id uuid not null references public.compliance_records (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_display_name text,
  action text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  record_id uuid not null references public.compliance_records (id) on delete cascade,
  name text not null,
  document_type text not null,
  notes text not null default '',
  added_date date not null,
  file_name text,
  storage_bucket text,
  storage_object_key text,
  mime_type text,
  file_size_bytes integer check (file_size_bytes is null or file_size_bytes >= 0),
  file_migrated boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  record_id uuid not null references public.compliance_records (id) on delete cascade,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'completed')),
  completed boolean not null default false,
  due_date date,
  owner text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint actions_completed_status_check check (
    (status = 'completed' and completed = true)
    or (status <> 'completed' and completed = false)
  )
);

comment on table public.history_entries is 'Append-only audit trail per compliance record.';
comment on table public.evidence_items is 'Evidence metadata; file bytes live in Storage (not alpha).';
comment on table public.actions is 'Action items per compliance record (v2.8 status, due date, owner).';
