-- Phase 3 Step 6C: update evidence metadata only (no file_data / Storage)

create or replace function public.update_evidence(
  p_evidence_id uuid,
  p_name text,
  p_document_type text,
  p_notes text default '',
  p_added_date date default null,
  p_file_name text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text;
  v_document_type text;
  v_notes text;
  v_added_date date;
  v_file_name text;
  v_evidence public.evidence_items%rowtype;
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
    raise exception 'Insufficient role to update evidence'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_name, ''));

  if v_name = '' then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'name',
      'reason',
      'blank'
    );
  end if;

  v_document_type := trim(coalesce(p_document_type, ''));

  if v_document_type = '' then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'document_type',
      'reason',
      'blank'
    );
  end if;

  select *
  into v_evidence
  from public.evidence_items ei
  where ei.id = p_evidence_id
    and ei.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_notes := coalesce(trim(p_notes), '');
  v_added_date := coalesce(p_added_date, v_evidence.added_date);
  v_file_name := nullif(trim(coalesce(p_file_name, v_evidence.file_name, '')), '');

  if v_evidence.name is not distinct from v_name
    and v_evidence.document_type is not distinct from v_document_type
    and v_evidence.notes is not distinct from v_notes
    and v_evidence.added_date is not distinct from v_added_date
    and v_evidence.file_name is not distinct from v_file_name then
    return jsonb_build_object('status', 'no_changes');
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Evidence updated: ' || v_document_type || '.';

  update public.evidence_items
  set
    name = v_name,
    document_type = v_document_type,
    notes = v_notes,
    added_date = v_added_date,
    file_name = v_file_name
  where id = p_evidence_id
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
    v_evidence.record_id,
    auth.uid(),
    v_actor_display_name,
    'evidence_updated',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'updated',
    'evidence_id',
    p_evidence_id,
    'record_id',
    v_evidence.record_id,
    'evidence',
    jsonb_build_object(
      'id',
      p_evidence_id,
      'name',
      v_name,
      'document_type',
      v_document_type,
      'notes',
      v_notes,
      'added_date',
      v_added_date,
      'file_name',
      v_file_name
    ),
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'evidence_updated',
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

comment on function public.update_evidence(uuid, text, text, text, date, text) is
  'Update evidence metadata with evidence_updated history (editor/admin). No Storage or file bytes.';

grant execute on function public.update_evidence(uuid, text, text, text, date, text) to authenticated;
