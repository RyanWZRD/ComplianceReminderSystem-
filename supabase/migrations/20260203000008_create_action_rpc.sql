-- Phase 3 Step 5A: create action (open status + action_added history)

create or replace function public.create_action(
  p_record_id uuid,
  p_title text,
  p_notes text default '',
  p_due_date date default null,
  p_owner text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_title text;
  v_action_id uuid;
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
    raise exception 'Insufficient role to create actions'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  v_title := trim(coalesce(p_title, ''));

  if v_title = '' then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'title',
      'reason',
      'blank'
    );
  end if;

  if not exists (
    select 1
    from public.compliance_records cr
    where cr.id = p_record_id
      and cr.organisation_id = v_org_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Action added: ' || v_title || '.';

  insert into public.actions (
    organisation_id,
    record_id,
    title,
    status,
    completed,
    due_date,
    owner,
    notes,
    completed_at
  )
  values (
    v_org_id,
    p_record_id,
    v_title,
    'open',
    false,
    p_due_date,
    coalesce(trim(p_owner), ''),
    coalesce(trim(p_notes), ''),
    null
  )
  returning id
  into v_action_id;

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
    p_record_id,
    auth.uid(),
    v_actor_display_name,
    'action_added',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'created',
    'action_id',
    v_action_id,
    'record_id',
    p_record_id,
    'title',
    v_title,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'action_added',
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

comment on function public.create_action(uuid, text, text, date, text) is
  'Create an open action on a compliance record with action_added history (editor/admin).';

grant execute on function public.create_action(uuid, text, text, date, text) to authenticated;
