-- V5-0 Phase 4: admin-only automation run creation RPC (audit record only — no execution)

create policy automation_runs_admin_insert
on public.automation_runs
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() = 'admin'
);

create or replace function public.create_automation_run(
  p_status text default 'completed',
  p_summary jsonb default '{}'::jsonb,
  p_error text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_status text;
  v_summary jsonb;
  v_completed_at timestamptz;
  v_row public.automation_runs%rowtype;
  v_allowed_statuses text[] := array['running', 'completed', 'failed', 'cancelled'];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if public.current_user_role() <> 'admin' then
    raise exception 'Insufficient role to create automation runs'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  v_status := nullif(trim(coalesce(p_status, '')), '');

  if v_status is null then
    v_status := 'completed';
  end if;

  if not (v_status = any (v_allowed_statuses)) then
    raise exception 'Invalid automation run status'
      using errcode = '22023';
  end if;

  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'Summary must be a JSON object'
      using errcode = '22023';
  end if;

  v_summary := p_summary;

  if v_status = 'running' then
    v_completed_at := null;
  else
    v_completed_at := now();
  end if;

  insert into public.automation_runs (
    organisation_id,
    status,
    summary,
    error,
    completed_at
  )
  values (
    v_org_id,
    v_status,
    v_summary,
    p_error,
    v_completed_at
  )
  returning *
  into v_row;

  return jsonb_build_object(
    'status', 'created',
    'run', jsonb_build_object(
      'id', v_row.id,
      'started_at', v_row.started_at,
      'completed_at', v_row.completed_at,
      'status', v_row.status,
      'summary', v_row.summary,
      'error', v_row.error,
      'created_at', v_row.created_at
    )
  );
end;
$$;

comment on function public.create_automation_run(text, jsonb, text) is
  'Create an org automation run audit record (admin only; no policy execution).';

grant execute on function public.create_automation_run(text, jsonb, text)
  to authenticated;
