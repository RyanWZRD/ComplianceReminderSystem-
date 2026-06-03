-- Phase 3 Step 5B: update action metadata only (no status transitions)

create or replace function public.update_action(
  p_action_id uuid,
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
  v_notes text;
  v_owner text;
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

  v_title := trim(coalesce(p_title, ''));
  v_notes := coalesce(p_notes, '');
  v_owner := trim(coalesce(p_owner, ''));

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

  select *
  into v_action
  from public.actions a
  where a.id = p_action_id
    and a.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_action.title is not distinct from v_title
    and v_action.notes is not distinct from v_notes
    and v_action.due_date is not distinct from p_due_date
    and v_action.owner is not distinct from v_owner then
    return jsonb_build_object('status', 'no_changes');
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Action updated: ' || v_title || '.';

  update public.actions
  set
    title = v_title,
    notes = v_notes,
    due_date = p_due_date,
    owner = v_owner
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
    'title',
    v_title,
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

comment on function public.update_action(uuid, text, text, date, text) is
  'Update action metadata (title, notes, due date, owner) with history; no status changes (editor/admin).';

grant execute on function public.update_action(uuid, text, text, date, text) to authenticated;
