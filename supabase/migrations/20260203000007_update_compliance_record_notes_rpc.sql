-- Phase 3 Step 4: update compliance record notes (workspace save; protected audit lines)

create or replace function public.compliance_notes_preserves_protected_lines(
  p_old_notes text,
  p_new_notes text
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_old_line text;
  v_new_line text;
  v_sentinel text;
  v_sentinels text[] := array[
    'Expired Reminder Sent',
    '30 Day Reminder Sent',
    '14 Day Reminder Sent',
    '7 Day Reminder Sent',
    'Compliance renewed. New expiry date:'
  ];
  v_found boolean;
begin
  foreach v_old_line in array regexp_split_to_array(coalesce(p_old_notes, ''), E'\\r?\\n')
  loop
    foreach v_sentinel in array v_sentinels
    loop
      if v_old_line like '%' || v_sentinel || '%' then
        v_found := false;

        foreach v_new_line in array regexp_split_to_array(coalesce(p_new_notes, ''), E'\\r?\\n')
        loop
          if v_new_line like '%' || v_sentinel || '%' then
            v_found := true;
            exit;
          end if;
        end loop;

        if not v_found then
          return false;
        end if;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

create or replace function public.update_compliance_record_notes(
  p_record_id uuid,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_old_notes text;
  v_notes text;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_actor_display_name text;
  v_history_description text := 'Notes updated.';
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to update compliance record notes'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select cr.notes
  into v_old_notes
  from public.compliance_records cr
  where cr.id = p_record_id
    and cr.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_notes := coalesce(p_notes, '');

  if v_notes is not distinct from v_old_notes then
    return jsonb_build_object('status', 'no_changes');
  end if;

  if not public.compliance_notes_preserves_protected_lines(v_old_notes, v_notes) then
    return jsonb_build_object(
      'status',
      'rejected',
      'reason',
      'protected_audit_lines_removed'
    );
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  update public.compliance_records
  set notes = v_notes
  where id = p_record_id
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
    p_record_id,
    auth.uid(),
    v_actor_display_name,
    'edited',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'updated',
    'notes',
    v_notes,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'edited',
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

comment on function public.compliance_notes_preserves_protected_lines(text, text) is
  'True when new notes still contain every reminder-sent / renew audit sentinel present in old notes.';

comment on function public.update_compliance_record_notes(uuid, text) is
  'Replace compliance record notes and append edited history (editor/admin). Preserves audit lines.';

grant execute on function public.update_compliance_record_notes(uuid, text) to authenticated;
