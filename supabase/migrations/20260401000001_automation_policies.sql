-- V5-0 Phase 1: org-scoped automation policy documents (foundation only — no RPCs or execution)

create table public.automation_policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  policy jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger automation_policies_set_updated_at
before update on public.automation_policies
for each row
execute function public.set_updated_at();

create index automation_policies_organisation_id_idx
  on public.automation_policies (organisation_id);

comment on table public.automation_policies is 'Org-scoped automation policy documents (V5-0 foundation).';
comment on column public.automation_policies.policy is 'JSON policy document; validated server-side in later V5 slices.';
comment on column public.automation_policies.enabled is 'Whether this policy row is active for the organisation.';
comment on column public.automation_policies.version is 'Policy document schema version number.';

alter table public.automation_policies enable row level security;

create policy automation_policies_admin_select
on public.automation_policies
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

create policy automation_policies_admin_insert
on public.automation_policies
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

create policy automation_policies_admin_update
on public.automation_policies
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

create policy automation_policies_admin_delete
on public.automation_policies
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);
