-- Phase 3 Step 5C: add default action templates (skip duplicate titles per record)

create or replace function public.add_default_actions(p_record_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_templates constant text[] := array[
    'Reminder sent',
    'Renewal chased',
    'Certificate received',
    'Evidence uploaded',
    'Renewal verified'
  ];
  v_template text;
  v_title text;
  v_action_id uuid;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_history_description text;
  v_actor_display_name text;
  v_added jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_added_count int := 0;
  v_skipped_count int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to add default actions'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
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

  foreach v_template in array v_templates loop
    v_title := v_template;

    if exists (
      select 1
      from public.actions a
      where a.record_id = p_record_id
        and a.organisation_id = v_org_id
        and lower(trim(a.title)) = lower(v_title)
    ) then
      v_skipped := v_skipped || to_jsonb(v_title);
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

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
      null,
      '',
      '',
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

    v_added := v_added || jsonb_build_array(
      jsonb_build_object(
        'action_id',
        v_action_id,
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
      )
    );
    v_added_count := v_added_count + 1;
  end loop;

  return jsonb_build_object(
    'status',
    'completed',
    'record_id',
    p_record_id,
    'added_count',
    v_added_count,
    'skipped_count',
    v_skipped_count,
    'added',
    v_added,
    'skipped_titles',
    v_skipped
  );
end;
$$;

comment on function public.add_default_actions(uuid) is
  'Add default open action templates to a record; skip titles that already exist (editor/admin).';

grant execute on function public.add_default_actions(uuid) to authenticated;
