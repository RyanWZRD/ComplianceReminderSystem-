-- V5-0 Phase 1: automation run audit log (foundation only — no scan, cron, or execution)

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  constraint automation_runs_status_check check (
    status in ('running', 'completed', 'failed', 'cancelled')
  )
);

create index automation_runs_organisation_id_idx
  on public.automation_runs (organisation_id);

create index automation_runs_org_started_at_idx
  on public.automation_runs (organisation_id, started_at desc);

comment on table public.automation_runs is 'Immutable audit log of automation scan/run attempts (V5-0 foundation).';
comment on column public.automation_runs.summary is 'Run outcome counts (policies applied, reminders queued, etc.).';
comment on column public.automation_runs.error is 'Failure message when status is failed or cancelled.';

alter table public.automation_runs enable row level security;

create policy automation_runs_member_select
on public.automation_runs
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);
