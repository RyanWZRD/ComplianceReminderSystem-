-- V5-1A Phase 2: optional email + manager_email on create/update compliance record RPCs

drop function if exists public.create_compliance_record(text, text, text, date, text);

create or replace function public.create_compliance_record(
  p_name text,
  p_role text,
  p_compliance_type text,
  p_expiry_date date,
  p_renewal_cycle text default null,
  p_email text default null,
  p_manager_email text default null
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
  v_email text;
  v_manager_email text;
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

  if p_email is not null and not public.is_valid_email(p_email) then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'email',
      'reason',
      'invalid_format'
    );
  end if;

  if p_manager_email is not null and not public.is_valid_email(p_manager_email) then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'manager_email',
      'reason',
      'invalid_format'
    );
  end if;

  v_email := public.normalize_email(p_email);
  v_manager_email := public.normalize_email(p_manager_email);

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
      role = v_role,
      email = case when p_email is not null then v_email else email end,
      manager_email = case when p_manager_email is not null then v_manager_email else manager_email end
    where id = v_person_id;
  else
    insert into public.people (organisation_id, name, role, email, manager_email)
    values (v_org_id, v_name, v_role, v_email, v_manager_email)
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

comment on function public.create_compliance_record(text, text, text, date, text, text, text) is
  'Create a compliance record; find-or-create person by case-insensitive name within org (editor/admin). Optional contact emails.';

grant execute on function public.create_compliance_record(text, text, text, date, text, text, text) to authenticated;

drop function if exists public.update_compliance_record(uuid, uuid, text, text, text, date, text);

create or replace function public.update_compliance_record(
  p_person_id uuid,
  p_record_id uuid,
  p_name text,
  p_role text,
  p_compliance_type text,
  p_expiry_date date,
  p_renewal_cycle text,
  p_email text default null,
  p_manager_email text default null
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
  v_email text;
  v_manager_email text;
  v_email_provided boolean := p_email is not null;
  v_manager_email_provided boolean := p_manager_email is not null;
  v_person public.people%rowtype;
  v_record public.compliance_records%rowtype;
  v_previous_cycle text;
  v_changes text[] := array[]::text[];
  v_cycle_changed boolean := false;
  v_history_entries jsonb := '[]'::jsonb;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_history_description text;
  v_actor_display_name text;
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
    raise exception 'Insufficient role to update compliance records'
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

  if v_email_provided and not public.is_valid_email(p_email) then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'email',
      'reason',
      'invalid_format'
    );
  end if;

  if v_manager_email_provided and not public.is_valid_email(p_manager_email) then
    return jsonb_build_object(
      'status',
      'validation_error',
      'field',
      'manager_email',
      'reason',
      'invalid_format'
    );
  end if;

  v_email := public.normalize_email(p_email);
  v_manager_email := public.normalize_email(p_manager_email);

  if not (v_type = any (v_allowed_types)) then
    v_type := 'DBS';
  end if;

  v_cycle := lower(trim(coalesce(p_renewal_cycle, 'manual')));

  if v_cycle not in ('manual', '6-months', '1-year', '2-years', '3-years', '5-years') then
    v_cycle := 'manual';
  end if;

  select *
  into v_record
  from public.compliance_records cr
  where cr.id = p_record_id
    and cr.organisation_id = v_org_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_record.person_id is distinct from p_person_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into v_person
  from public.people p
  where p.id = p_person_id
    and p.organisation_id = v_org_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_previous_cycle := lower(trim(coalesce(v_record.renewal_cycle, 'manual')));

  if v_previous_cycle not in ('manual', '6-months', '1-year', '2-years', '3-years', '5-years') then
    v_previous_cycle := 'manual';
  end if;

  if v_person.name is distinct from v_name then
    if exists (
      select 1
      from public.people p
      where p.organisation_id = v_org_id
        and p.id <> p_person_id
        and lower(trim(p.name)) = lower(v_name)
    ) then
      return jsonb_build_object('status', 'name_conflict');
    end if;

    v_changes := array_append(v_changes, format('name to "%s"', v_name));
  end if;

  if v_person.role is distinct from v_role then
    v_changes := array_append(v_changes, format('role to "%s"', v_role));
  end if;

  if v_email_provided and v_person.email is distinct from v_email then
    v_changes := array_append(
      v_changes,
      case
        when v_email is null then 'email cleared'
        else format('email to "%s"', v_email)
      end
    );
  end if;

  if v_manager_email_provided and v_person.manager_email is distinct from v_manager_email then
    v_changes := array_append(
      v_changes,
      case
        when v_manager_email is null then 'manager email cleared'
        else format('manager email to "%s"', v_manager_email)
      end
    );
  end if;

  if v_record.compliance_type is distinct from v_type then
    v_changes := array_append(v_changes, format('type to %s', v_type));
  end if;

  if v_record.expiry_date is distinct from p_expiry_date then
    v_changes := array_append(
      v_changes,
      format('expiry to %s', to_char(p_expiry_date, 'FMDD Mon YYYY'))
    );
  end if;

  if v_previous_cycle is distinct from v_cycle then
    v_cycle_changed := true;
  end if;

  if array_length(v_changes, 1) is null and not v_cycle_changed then
    return jsonb_build_object('status', 'no_changes');
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  if v_person.name is distinct from v_name
    or v_person.role is distinct from v_role
    or (v_email_provided and v_person.email is distinct from v_email)
    or (v_manager_email_provided and v_person.manager_email is distinct from v_manager_email) then
    update public.people
    set
      name = v_name,
      role = v_role,
      email = case when v_email_provided then v_email else email end,
      manager_email = case when v_manager_email_provided then v_manager_email else manager_email end
    where id = p_person_id
      and organisation_id = v_org_id;
  end if;

  if array_length(v_changes, 1) is not null
    or v_record.compliance_type is distinct from v_type
    or v_record.expiry_date is distinct from p_expiry_date
    or v_cycle_changed then
    update public.compliance_records
    set
      compliance_type = v_type,
      expiry_date = p_expiry_date,
      renewal_cycle = v_cycle
    where id = p_record_id
      and organisation_id = v_org_id;
  end if;

  if v_cycle_changed then
    v_history_description :=
      'Renewal cycle changed from '
      || public.renewal_cycle_label(v_previous_cycle)
      || ' to '
      || public.renewal_cycle_label(v_cycle)
      || '.';

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

    v_history_entries :=
      v_history_entries
      || jsonb_build_array(
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
  end if;

  if array_length(v_changes, 1) is not null then
    v_history_description :=
      'Record updated ('
      || array_to_string(v_changes, '; ')
      || ').';

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

    v_history_entries :=
      v_history_entries
      || jsonb_build_array(
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
  end if;

  return jsonb_build_object(
    'status',
    'updated',
    'person_id',
    p_person_id,
    'record_id',
    p_record_id,
    'history_entries',
    v_history_entries
  );
end;
$$;

comment on function public.update_compliance_record(uuid, uuid, text, text, text, date, text, text, text) is
  'Update person name/role/contact emails and compliance record fields (editor/admin). Notes are not modified.';

grant execute on function public.update_compliance_record(uuid, uuid, text, text, text, date, text, text, text) to authenticated;
