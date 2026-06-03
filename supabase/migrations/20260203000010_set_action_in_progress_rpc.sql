-- Phase 3 Step 5B: mark action in progress (open -> in_progress only)

create or replace function public.set_action_in_progress(
  p_action_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action public.actions%rowtype;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_history_description text;
  v_actor_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to update actions'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select *
  into v_action
  from public.actions a
  where a.id = p_action_id
    and a.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_action.status = 'completed' then
    return jsonb_build_object(
      'status',
      'invalid_transition',
      'reason',
      'only_open_to_in_progress'
    );
  end if;

  if v_action.status = 'in_progress' then
    return jsonb_build_object('status', 'no_changes');
  end if;

  if v_action.status <> 'open' then
    return jsonb_build_object(
      'status',
      'invalid_transition',
      'reason',
      'only_open_to_in_progress'
    );
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Action marked in progress: ' || v_action.title || '.';

  update public.actions
  set
    status = 'in_progress',
    completed = false,
    completed_at = null
  where id = p_action_id
    and organisation_id = v_org_id;

  insert into public.history_entries (
    organisation_id,
    record_id,
    actor_id,
    actor_display_name,
    action,
    description
  )
  values (
    v_org_id,
    v_action.record_id,
    auth.uid(),
    v_actor_display_name,
    'action_updated',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'updated',
    'action_id',
    p_action_id,
    'target_status',
    'in_progress',
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'action_updated',
      'description',
      v_history_description,
      'created_at',
      v_history_created_at,
      'actor_id',
      auth.uid(),
      'actor_display_name',
      v_actor_display_name
    )
  );
end;
$$;

comment on function public.set_action_in_progress(uuid) is
  'Transition action status open->in_progress with history (editor/admin).';

grant execute on function public.set_action_in_progress(uuid) to authenticated;
