-- V5-0 Phase 3: automation run read RPCs (no execution, queue, or writes)

create or replace function public.get_automation_runs()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_runs jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to read automation runs'
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
        'id', ar.id,
        'started_at', ar.started_at,
        'completed_at', ar.completed_at,
        'status', ar.status,
        'summary', ar.summary,
        'error', ar.error,
        'created_at', ar.created_at
      )
      order by ar.started_at desc
    ),
    '[]'::jsonb
  )
  into v_runs
  from public.automation_runs ar
  where ar.organisation_id = v_org_id;

  return jsonb_build_object(
    'status', 'ok',
    'runs', v_runs
  );
end;
$$;

create or replace function public.get_automation_run(
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row public.automation_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to read automation runs'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select *
  into v_row
  from public.automation_runs ar
  where ar.organisation_id = v_org_id
    and ar.id = p_run_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
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

comment on function public.get_automation_runs() is
  'List org automation runs newest first (admin + editor read).';

comment on function public.get_automation_run(uuid) is
  'Fetch a single org automation run by id (admin + editor read).';

grant execute on function public.get_automation_runs()
  to authenticated;

grant execute on function public.get_automation_run(uuid)
  to authenticated;
