-- Phase 2 Step 8: action status transitions (open <-> completed only)

create or replace function public.set_action_status(
  p_action_id uuid,
  p_target_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_action public.actions%rowtype;
  v_history_action text;
  v_history_description text;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_actor_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to update action status'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  if p_target_status not in ('open', 'completed') then
    raise exception 'Invalid target status: %', p_target_status
      using errcode = '22023';
  end if;

  select *
  into v_action
  from public.actions a
  where a.id = p_action_id
    and a.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_target_status = 'completed' and v_action.status <> 'open' then
    return jsonb_build_object(
      'status',
      'invalid_transition',
      'reason',
      'only_open_to_completed'
    );
  end if;

  if p_target_status = 'open' and v_action.status <> 'completed' then
    return jsonb_build_object(
      'status',
      'invalid_transition',
      'reason',
      'only_completed_to_open'
    );
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  if p_target_status = 'completed' then
    v_history_action := 'action_completed';
    v_history_description := 'Action completed: ' || v_action.title || '.';
  else
    v_history_action := 'action_reopened';
    v_history_description := 'Action reopened: ' || v_action.title || '.';
  end if;

  update public.actions
  set
    status = p_target_status,
    completed = (p_target_status = 'completed'),
    completed_at = case
      when p_target_status = 'completed' then now()
      else null
    end
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
    v_history_action,
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
    p_target_status,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      v_history_action,
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

comment on function public.set_action_status(uuid, text) is
  'Transition action status open->completed or completed->open with history (editor/admin).';

grant execute on function public.set_action_status(uuid, text) to authenticated;
