-- Phase 3 Step 7A: archive compliance record (deleted snapshot + remove active record)

create or replace function public.archive_compliance_record(
  p_record_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_record public.compliance_records%rowtype;
  v_person public.people%rowtype;
  v_actor_display_name text;
  v_expiry_display text;
  v_history_description text;
  v_history_id uuid := gen_random_uuid();
  v_deleted_at timestamptz := now();
  v_snapshot_id uuid;
  v_history jsonb := '[]'::jsonb;
  v_evidence jsonb := '[]'::jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_deleted_history jsonb;
  v_record_snapshot jsonb;
  v_remaining_records integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to archive compliance records'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select cr.*
  into v_record
  from public.compliance_records cr
  where cr.id = p_record_id
    and cr.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select p.*
  into v_person
  from public.people p
  where p.id = v_record.person_id
    and p.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select pr.display_name
  into v_actor_display_name
  from public.profiles pr
  where pr.id = auth.uid();

  v_expiry_display := trim(leading '0' from to_char(v_record.expiry_date, 'DD Mon YYYY'));
  v_history_description := 'Record deleted (' || v_record.compliance_type || ', expires ' || v_expiry_display || ').';

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id',
          h.id,
          'action',
          h.action,
          'timestamp',
          h.created_at,
          'description',
          h.description,
          'userId',
          h.actor_id,
          'userDisplayName',
          h.actor_display_name
        )
      )
      order by h.created_at desc
    ),
    '[]'::jsonb
  )
  into v_history
  from public.history_entries h
  where h.record_id = p_record_id
    and h.organisation_id = v_org_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        ei.id,
        'name',
        ei.name,
        'documentType',
        ei.document_type,
        'addedDate',
        to_char(ei.added_date, 'YYYY-MM-DD'),
        'notes',
        ei.notes,
        'fileName',
        ei.file_name,
        'fileData',
        null
      )
    ),
    '[]'::jsonb
  )
  into v_evidence
  from public.evidence_items ei
  where ei.record_id = p_record_id
    and ei.organisation_id = v_org_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        a.id,
        'title',
        a.title,
        'status',
        a.status,
        'completed',
        a.completed,
        'dueDate',
        case
          when a.due_date is null then null
          else to_char(a.due_date, 'YYYY-MM-DD')
        end,
        'owner',
        a.owner,
        'notes',
        a.notes,
        'createdAt',
        a.created_at,
        'completedAt',
        a.completed_at
      )
    ),
    '[]'::jsonb
  )
  into v_actions
  from public.actions a
  where a.record_id = p_record_id
    and a.organisation_id = v_org_id;

  v_deleted_history := jsonb_strip_nulls(
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'deleted',
      'timestamp',
      v_deleted_at,
      'description',
      v_history_description,
      'userId',
      auth.uid(),
      'userDisplayName',
      v_actor_display_name
    )
  );

  v_history := jsonb_build_array(v_deleted_history) || v_history;

  v_record_snapshot := jsonb_build_object(
    'id',
    v_record.id,
    'complianceType',
    v_record.compliance_type,
    'expiryDate',
    to_char(v_record.expiry_date, 'YYYY-MM-DD'),
    'renewalCycle',
    v_record.renewal_cycle,
    'notes',
    v_record.notes,
    'history',
    v_history,
    'evidence',
    v_evidence,
    'actions',
    v_actions
  );

  insert into public.deleted_record_snapshots (
    organisation_id,
    deleted_at,
    person_name,
    person_role,
    record_snapshot,
    deleted_by
  )
  values (
    v_org_id,
    v_deleted_at,
    v_person.name,
    v_person.role,
    v_record_snapshot,
    auth.uid()
  )
  returning id
  into v_snapshot_id;

  delete from public.compliance_records
  where id = p_record_id
    and organisation_id = v_org_id;

  select count(*)
  into v_remaining_records
  from public.compliance_records cr
  where cr.person_id = v_person.id
    and cr.organisation_id = v_org_id;

  if v_remaining_records = 0 then
    delete from public.people
    where id = v_person.id
      and organisation_id = v_org_id;
  end if;

  return jsonb_build_object(
    'status',
    'archived',
    'record_id',
    p_record_id,
    'deleted_snapshot_id',
    v_snapshot_id,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'deleted',
      'description',
      v_history_description,
      'created_at',
      v_deleted_at,
      'actor_id',
      auth.uid(),
      'actor_display_name',
      v_actor_display_name
    )
  );
end;
$$;

comment on function public.archive_compliance_record(uuid) is
  'Archive a compliance record into deleted_record_snapshots and remove the active row (editor/admin).';

grant execute on function public.archive_compliance_record(uuid) to authenticated;
