-- Phase 2 Step 10: create compliance record (find-or-create person + history)

create or replace function public.create_compliance_record(
  p_name text,
  p_role text,
  p_compliance_type text,
  p_expiry_date date,
  p_renewal_cycle text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_name text;
  v_role text;
  v_type text;
  v_cycle text;
  v_person_id uuid;
  v_record_id uuid;
  v_is_new_person boolean := false;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_history_description text;
  v_actor_display_name text;
  v_expiry_display text;
  v_allowed_types text[] := array[
    'DBS',
    'Basic Awareness',
    'Foundations',
    'Leadership',
    'Senior Leadership',
    'Domestic Abuse',
    'Safer Recruitment',
    'Modern Slavery'
  ];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to create compliance records'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  v_name := trim(coalesce(p_name, ''));
  v_role := trim(coalesce(p_role, ''));
  v_type := trim(coalesce(p_compliance_type, ''));

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

  if v_role = '' then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'role',
      'reason',
      'blank'
    );
  end if;

  if v_type = '' then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'compliance_type',
      'reason',
      'blank'
    );
  end if;

  if p_expiry_date is null then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'expiry_date',
      'reason',
      'missing'
    );
  end if;

  if not (v_type = any (v_allowed_types)) then
    v_type := 'DBS';
  end if;

  v_cycle := lower(trim(coalesce(p_renewal_cycle, '3-years')));

  if v_cycle not in ('manual', '6-months', '1-year', '2-years', '3-years', '5-years') then
    v_cycle := 'manual';
  end if;

  if p_renewal_cycle is null or trim(coalesce(p_renewal_cycle, '')) = '' then
    v_cycle := '3-years';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_org_id::text || ':' || lower(v_name))
  );

  select p.id
  into v_person_id
  from public.people p
  where p.organisation_id = v_org_id
    and lower(trim(p.name)) = lower(v_name)
  for update;

  if found then
    update public.people
    set
      name = v_name,
      role = v_role
    where id = v_person_id;
  else
    insert into public.people (organisation_id, name, role)
    values (v_org_id, v_name, v_role)
    returning id into v_person_id;

    v_is_new_person := true;
  end if;

  insert into public.compliance_records (
    organisation_id,
    person_id,
    compliance_type,
    expiry_date,
    renewal_cycle,
    notes
  )
  values (
    v_org_id,
    v_person_id,
    v_type,
    p_expiry_date,
    v_cycle,
    ''
  )
  returning id into v_record_id;

  v_expiry_display := to_char(p_expiry_date, 'FMDD Mon YYYY');

  v_history_description :=
    'Record created ('
    || v_type
    || ', expires '
    || v_expiry_display
    || ').';

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

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
    v_record_id,
    auth.uid(),
    v_actor_display_name,
    'created',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'created',
    'person_id',
    v_person_id,
    'record_id',
    v_record_id,
    'is_new_person',
    v_is_new_person,
    'compliance_type',
    v_type,
    'expiry_date',
    p_expiry_date,
    'renewal_cycle',
    v_cycle,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'created',
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

comment on function public.create_compliance_record(text, text, text, date, text) is
  'Create a compliance record; find-or-create person by case-insensitive name within org (editor/admin).';

grant execute on function public.create_compliance_record(text, text, text, date, text) to authenticated;
