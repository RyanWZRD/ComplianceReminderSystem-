-- V6 Phase 49: reminder delivery log schema for future scheduled email sends (schema only)
-- Replaces Phase 3 foundation shape. No Edge Function writes, RPC changes, or app wiring in this phase.

drop table if exists public.reminder_delivery_logs cascade;

create table public.reminder_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  automation_run_id uuid references public.automation_runs (automation_run_id) on delete set null,
  compliance_record_id uuid references public.compliance_records (id) on delete set null,
  person_id uuid references public.people (id) on delete set null,
  recipient_email text,
  recipient_name text,
  compliance_type text,
  reminder_type text,
  due_date date,
  delivery_status text not null default 'pending',
  provider text,
  provider_message_id text,
  error_code text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint reminder_delivery_logs_delivery_status_check check (
    delivery_status in ('pending', 'sent', 'skipped', 'failed')
  )
);

create index reminder_delivery_logs_organisation_id_idx
  on public.reminder_delivery_logs (organisation_id);

create index reminder_delivery_logs_automation_run_id_idx
  on public.reminder_delivery_logs (automation_run_id);

create index reminder_delivery_logs_compliance_record_id_idx
  on public.reminder_delivery_logs (compliance_record_id);

create index reminder_delivery_logs_delivery_status_idx
  on public.reminder_delivery_logs (delivery_status);

create index reminder_delivery_logs_created_at_desc_idx
  on public.reminder_delivery_logs (created_at desc);

create index reminder_delivery_logs_provider_message_id_idx
  on public.reminder_delivery_logs (provider_message_id)
  where provider_message_id is not null;

comment on table public.reminder_delivery_logs is
  'Per-recipient reminder delivery audit log for scheduled email sends (V6 Phase 49 — schema only).';
comment on column public.reminder_delivery_logs.delivery_status is
  'Outcome: pending, sent, skipped, or failed.';
comment on column public.reminder_delivery_logs.payload is
  'Denormalised send context (subject, body, metadata) for audit.';
comment on column public.reminder_delivery_logs.recipient_email is
  'Nullable — skipped or missing-email rows may have no address.';

alter table public.reminder_delivery_logs enable row level security;

create policy reminder_delivery_logs_org_select
on public.reminder_delivery_logs
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
);

-- Inserts, updates, and deletes are server-side only (service role bypasses RLS).
-- No authenticated insert/update/delete policies for normal client users.
