-- V5-0 Phase 2: automation policy types, editor read RLS, admin RPCs (no execution)

alter table public.automation_policies
  add column policy_type text;

update public.automation_policies
set policy_type = coalesce(nullif(trim(policy->>'type'), ''), 'reminder_digest')
where policy_type is null;

alter table public.automation_policies
  alter column policy_type set not null;

alter table public.automation_policies
  add constraint automation_policies_policy_type_check
  check (
    policy_type in ('reminder_digest', 'action_orchestration', 'escalation')
  );

create unique index automation_policies_org_policy_type_idx
  on public.automation_policies (organisation_id, policy_type);

comment on column public.automation_policies.policy_type is
  'Automation policy category: reminder_digest, action_orchestration, or escalation.';

drop policy if exists automation_policies_admin_select on public.automation_policies;

create policy automation_policies_read
on public.automation_policies
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create or replace function public.get_automation_policies()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_policies jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to read automation policies'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ap.id,
        'policy_type', ap.policy_type,
        'policy', ap.policy,
        'enabled', ap.enabled,
        'version', ap.version,
        'created_at', ap.created_at,
        'updated_at', ap.updated_at
      )
      order by ap.policy_type
    ),
    '[]'::jsonb
  )
  into v_policies
  from public.automation_policies ap
  where ap.organisation_id = v_org_id;

  return jsonb_build_object(
    'status', 'ok',
    'policies', v_policies
  );
end;
$$;

create or replace function public.upsert_automation_policy(
  p_policy_type text,
  p_policy jsonb,
  p_enabled boolean default false,
  p_version integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_policy_type text;
  v_policy jsonb;
  v_row public.automation_policies%rowtype;
  v_allowed_types text[] := array['reminder_digest', 'action_orchestration', 'escalation'];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if public.current_user_role() <> 'admin' then
    raise exception 'Insufficient role to upsert automation policies'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  v_policy_type := nullif(trim(p_policy_type), '');

  if v_policy_type is null or not (v_policy_type = any (v_allowed_types)) then
    raise exception 'Invalid automation policy type'
      using errcode = '22023';
  end if;

  if p_policy is null or jsonb_typeof(p_policy) <> 'object' then
    raise exception 'Policy document must be a JSON object'
      using errcode = '22023';
  end if;

  v_policy := p_policy || jsonb_build_object('type', v_policy_type);

  insert into public.automation_policies (
    organisation_id,
    policy_type,
    policy,
    enabled,
    version
  )
  values (
    v_org_id,
    v_policy_type,
    v_policy,
    coalesce(p_enabled, false),
    greatest(coalesce(p_version, 1), 1)
  )
  on conflict (organisation_id, policy_type) do update
  set
    policy = excluded.policy,
    enabled = excluded.enabled,
    version = greatest(excluded.version, public.automation_policies.version),
    updated_at = now()
  returning *
  into v_row;

  return jsonb_build_object(
    'status', 'upserted',
    'policy', jsonb_build_object(
      'id', v_row.id,
      'policy_type', v_row.policy_type,
      'policy', v_row.policy,
      'enabled', v_row.enabled,
      'version', v_row.version,
      'created_at', v_row.created_at,
      'updated_at', v_row.updated_at
    )
  );
end;
$$;

comment on function public.get_automation_policies() is
  'List org automation policies (admin + editor read).';

comment on function public.upsert_automation_policy(text, jsonb, boolean, integer) is
  'Create or update an org automation policy by type (admin only).';

grant execute on function public.get_automation_policies()
  to authenticated;

grant execute on function public.upsert_automation_policy(text, jsonb, boolean, integer)
  to authenticated;
