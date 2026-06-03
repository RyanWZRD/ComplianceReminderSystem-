-- Phase 3 Step 6B: delete evidence (evidence_deleted history before removal)

create or replace function public.delete_evidence(
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
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
    raise exception 'Insufficient role to delete evidence'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  select *
  into v_evidence
  from public.evidence_items ei
  where ei.id = p_evidence_id
    and ei.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  v_history_description := 'Evidence deleted: ' || v_evidence.document_type || '.';

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
    'evidence_deleted',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  delete from public.evidence_items
  where id = p_evidence_id
    and organisation_id = v_org_id;

  return jsonb_build_object(
    'status',
    'deleted',
    'evidence_id',
    p_evidence_id,
    'record_id',
    v_evidence.record_id,
    'document_type',
    v_evidence.document_type,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'evidence_deleted',
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

comment on function public.delete_evidence(uuid) is
  'Delete evidence metadata after recording evidence_deleted history (editor/admin).';

grant execute on function public.delete_evidence(uuid) to authenticated;
