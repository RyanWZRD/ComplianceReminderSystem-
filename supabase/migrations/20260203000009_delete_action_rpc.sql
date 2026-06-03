-- Phase 3 Step 5A: delete action (action_deleted history before removal)

create or replace function public.delete_action(
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
    raise exception 'Insufficient role to delete actions'
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

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Action deleted: ' || v_action.title || '.';

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
    'action_deleted',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  delete from public.actions
  where id = p_action_id
    and organisation_id = v_org_id;

  return jsonb_build_object(
    'status',
    'deleted',
    'action_id',
    p_action_id,
    'record_id',
    v_action.record_id,
    'title',
    v_action.title,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'action_deleted',
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

comment on function public.delete_action(uuid) is
  'Delete an action after recording action_deleted history (editor/admin).';

grant execute on function public.delete_action(uuid) to authenticated;
