-- V6 Phase 3: reminder delivery log schema (foundation only — no RPCs, provider, or execution)

create table public.reminder_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  automation_run_id uuid references public.automation_runs (id) on delete set null,
  queue_item_id text not null,
  compliance_record_id uuid references public.compliance_records (id) on delete set null,
  person_id uuid references public.people (id) on delete set null,
  recipient_email text,
  subject text not null,
  body_text text not null,
  delivery_status text not null,
  prepared_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_delivery_logs_delivery_status_check check (
    delivery_status in ('queued', 'prepared', 'sending', 'delivered', 'failed', 'cancelled')
  )
);

create trigger reminder_delivery_logs_set_updated_at
before update on public.reminder_delivery_logs
for each row
execute function public.set_updated_at();

create index reminder_delivery_logs_organisation_id_idx
  on public.reminder_delivery_logs (organisation_id);

create index reminder_delivery_logs_org_created_at_idx
  on public.reminder_delivery_logs (organisation_id, created_at desc);

create unique index reminder_delivery_logs_dedup_idx
  on public.reminder_delivery_logs (
    organisation_id,
    compliance_record_id,
    (metadata->>'reminderWindow'),
    ((prepared_at at time zone 'UTC')::date)
  )
  where compliance_record_id is not null;

comment on table public.reminder_delivery_logs is 'Per-recipient reminder delivery audit log (V6 Phase 3 foundation).';
comment on column public.reminder_delivery_logs.queue_item_id is 'Stable id linking back to the V5 reminder queue item.';
comment on column public.reminder_delivery_logs.delivery_status is 'Lifecycle state: queued, prepared, sending, delivered, failed, or cancelled.';
comment on column public.reminder_delivery_logs.metadata is 'Denormalised context (e.g. reminderWindow) for dedup and audit.';

alter table public.reminder_delivery_logs enable row level security;

create policy reminder_delivery_logs_member_select
on public.reminder_delivery_logs
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy reminder_delivery_logs_admin_insert
on public.reminder_delivery_logs
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

create policy reminder_delivery_logs_admin_update
on public.reminder_delivery_logs
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);
