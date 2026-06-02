-- v3.0.0 Alpha Phase 1: register core tables

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compliance_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  compliance_type text not null,
  expiry_date date not null,
  renewal_cycle text not null default 'manual',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger people_set_updated_at
before update on public.people
for each row
execute function public.set_updated_at();

create trigger compliance_records_set_updated_at
before update on public.compliance_records
for each row
execute function public.set_updated_at();

comment on table public.people is 'Person identity (name, role) within an organisation.';
comment on table public.compliance_records is 'One compliance item per person (DBS, training, etc.).';
