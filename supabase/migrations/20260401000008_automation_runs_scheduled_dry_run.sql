-- V6 Phase 47: scheduled runner dry-run audit columns on automation_runs
-- Table created in 20260401000002_automation_runs.sql — extend for server-side dry-run records.

alter table public.automation_runs
  add column if not exists automation_run_id uuid default gen_random_uuid(),
  add column if not exists run_type text default 'scheduled_reminder_dry_run',
  add column if not exists mode text default 'dry_run',
  add column if not exists as_of_date date,
  add column if not exists total_candidates integer not null default 0,
  add column if not exists with_email integer not null default 0,
  add column if not exists missing_email integer not null default 0,
  add column if not exists would_send integer not null default 0,
  add column if not exists would_skip integer not null default 0;

update public.automation_runs
set automation_run_id = gen_random_uuid()
where automation_run_id is null;

alter table public.automation_runs
  alter column automation_run_id set not null;

alter table public.automation_runs
  add constraint automation_runs_automation_run_id_key unique (automation_run_id);

create index if not exists automation_runs_automation_run_id_idx
  on public.automation_runs (automation_run_id);

create index if not exists automation_runs_created_at_desc_idx
  on public.automation_runs (created_at desc);

comment on column public.automation_runs.automation_run_id is
  'External automation run identifier returned to scheduled runner callers (V6 Phase 47).';
comment on column public.automation_runs.run_type is
  'Automation run kind — scheduled_reminder_dry_run for Phase 47 dry-run audit rows.';
comment on column public.automation_runs.mode is
  'Execution mode — dry_run for Phase 47 scheduled runner audit rows.';
comment on column public.automation_runs.as_of_date is
  'Candidate scan as-of date for scheduled runner dry runs.';

-- RLS remains enabled from foundation migration (alter table public.automation_runs enable row level security).
-- Inserts for scheduled runner dry runs use service role in Edge Functions only.
-- Authenticated client inserts remain limited to admin via create_automation_run RPC.
