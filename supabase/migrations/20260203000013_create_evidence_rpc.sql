-- Phase 3 Step 6A: create evidence metadata + evidence_added history

create or replace function public.create_evidence(
  p_record_id uuid,
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
  v_added_date date;
  v_evidence_id uuid;
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
    raise exception 'Insufficient role to create evidence'
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

  if not exists (
    select 1
    from public.compliance_records cr
    where cr.id = p_record_id
      and cr.organisation_id = v_org_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_added_date := coalesce(p_added_date, current_date);

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Evidence added: ' || v_document_type || '.';

  insert into public.evidence_items (
    organisation_id,
    record_id,
    name,
    document_type,
    notes,
    added_date,
    file_name
  )
  values (
    v_org_id,
    p_record_id,
    v_name,
    v_document_type,
    coalesce(trim(p_notes), ''),
    v_added_date,
    nullif(trim(coalesce(p_file_name, '')), '')
  )
  returning id
  into v_evidence_id;

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
    'evidence_added',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'created',
    'evidence_id',
    v_evidence_id,
    'record_id',
    p_record_id,
    'evidence',
    jsonb_build_object(
      'id',
      v_evidence_id,
      'name',
      v_name,
      'document_type',
      v_document_type,
      'notes',
      coalesce(trim(p_notes), ''),
      'added_date',
      v_added_date,
      'file_name',
      nullif(trim(coalesce(p_file_name, '')), '')
    ),
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'evidence_added',
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

comment on function public.create_evidence(uuid, text, text, text, date, text) is
  'Create evidence metadata on a compliance record with evidence_added history (editor/admin).';

grant execute on function public.create_evidence(uuid, text, text, text, date, text) to authenticated;
