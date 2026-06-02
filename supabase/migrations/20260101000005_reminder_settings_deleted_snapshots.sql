-- v3.0.0 Alpha Phase 1: org settings and deleted record archive

create table public.reminder_settings (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  days_30 boolean not null default true,
  days_14 boolean not null default true,
  days_7 boolean not null default true,
  hide_sent_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger reminder_settings_set_updated_at
before update on public.reminder_settings
for each row
execute function public.set_updated_at();

create table public.deleted_record_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  deleted_at timestamptz not null default now(),
  person_name text not null,
  person_role text not null,
  record_snapshot jsonb not null,
  deleted_by uuid references public.profiles (id) on delete set null
);

comment on table public.reminder_settings is 'Organisation-level reminder window configuration.';
comment on table public.deleted_record_snapshots is 'Tombstone archive when records are deleted (local deletedRecordHistory parity).';
