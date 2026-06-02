-- Phase 2 Step 9: renew compliance (expiry_date + notes + history)

create or replace function public.renew_compliance(
  p_record_id uuid,
  p_renewal_mode text,
  p_new_expiry_date date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_record public.compliance_records%rowtype;
  v_cycle text;
  v_new_expiry date;
  v_notes text;
  v_audit_line text;
  v_history_description text;
  v_cycle_renewal_text text;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_actor_display_name text;
  v_today_london date;
  v_new_expiry_display text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to renew compliance'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  if p_renewal_mode not in ('suggested', 'custom') then
    raise exception 'Invalid renewal mode: %', p_renewal_mode
      using errcode = '22023';
  end if;

  v_today_london := (timezone('Europe/London', now()))::date;

  select *
  into v_record
  from public.compliance_records cr
  where cr.id = p_record_id
    and cr.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_cycle := lower(trim(coalesce(v_record.renewal_cycle, 'manual')));

  if v_cycle not in ('6-months', '1-year', '2-years', '3-years', '5-years', 'manual') then
    v_cycle := 'manual';
  end if;

  if p_renewal_mode = 'suggested' then
    if v_cycle = 'manual' then
      return jsonb_build_object(
        'status',
        'suggested_unavailable',
        'reason',
        'manual_cycle'
      );
    end if;

    v_new_expiry := case v_cycle
      when '6-months' then (v_record.expiry_date + interval '6 months')::date
      when '1-year' then (v_record.expiry_date + interval '1 year')::date
      when '2-years' then (v_record.expiry_date + interval '2 years')::date
      when '3-years' then (v_record.expiry_date + interval '3 years')::date
      when '5-years' then (v_record.expiry_date + interval '5 years')::date
      else null
    end;

    if v_new_expiry is null then
      return jsonb_build_object(
        'status',
        'suggested_unavailable',
        'reason',
        'unsupported_cycle'
      );
    end if;

    v_cycle_renewal_text := case v_cycle
      when '6-months' then '6 Month'
      when '1-year' then '1 Year'
      when '2-years' then '2 Year'
      when '3-years' then '3 Year'
      when '5-years' then '5 Year'
      else 'Manual'
    end;

    v_history_description :=
      'Compliance renewed using '
      || v_cycle_renewal_text
      || ' cycle. New expiry date: '
      || to_char(v_new_expiry, 'DD/MM/YYYY')
      || '.';
  else
    if p_new_expiry_date is null then
      return jsonb_build_object('status', 'invalid_date', 'reason', 'missing_date');
    end if;

    if p_new_expiry_date < v_today_london then
      return jsonb_build_object(
        'status',
        'invalid_date',
        'reason',
        'before_today'
      );
    end if;

    v_new_expiry := p_new_expiry_date;

    v_history_description :=
      'Compliance renewed using custom expiry date: '
      || to_char(v_new_expiry, 'DD/MM/YYYY')
      || '.';
  end if;

  v_new_expiry_display := to_char(v_new_expiry, 'DD/MM/YYYY');

  v_audit_line := to_char(v_today_london, 'DD/MM/YYYY')
    || ' - Compliance renewed. New expiry date: '
    || v_new_expiry_display;

  v_notes := coalesce(v_record.notes, '');

  if coalesce(trim(v_notes), '') = '' then
    v_notes := v_audit_line;
  else
    v_notes := trim(v_notes) || E'\n' || v_audit_line;
  end if;

  select p.display_name
  into v_actor_display_name
  from public.profiles p
  where p.id = auth.uid();

  update public.compliance_records
  set
    expiry_date = v_new_expiry,
    notes = v_notes
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
    'renewed',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'renewed',
    'expiry_date',
    v_new_expiry,
    'notes',
    v_notes,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'renewed',
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

comment on function public.renew_compliance(uuid, text, date) is
  'Renew compliance expiry with audit notes and history (editor/admin). Custom date must be today or later (Europe/London).';

grant execute on function public.renew_compliance(uuid, text, date) to authenticated;
