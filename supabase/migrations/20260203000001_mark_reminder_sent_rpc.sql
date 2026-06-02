-- Phase 2 Step 7: atomic mark reminder sent (notes + history)
-- Audit dates use Europe/London to match UK register expectations.

create or replace function public.mark_reminder_sent(
  p_record_id uuid,
  p_reminder_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_notes text;
  v_sent_label text;
  v_audit_line text;
  v_history_description text;
  v_history_id uuid;
  v_history_created_at timestamptz;
  v_actor_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to mark reminders sent'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  case p_reminder_type
    when 'expired' then
      v_sent_label := 'Expired Reminder Sent';
    when '30' then
      v_sent_label := '30 Day Reminder Sent';
    when '14' then
      v_sent_label := '14 Day Reminder Sent';
    when '7' then
      v_sent_label := '7 Day Reminder Sent';
    else
      raise exception 'Invalid reminder type: %', p_reminder_type
        using errcode = '22023';
  end case;

  select cr.notes
  into v_notes
  from public.compliance_records cr
  where cr.id = p_record_id
    and cr.organisation_id = v_org_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_notes is not null
    and exists (
      select 1
      from unnest(regexp_split_to_array(v_notes, E'\\r?\\n')) as line
      where line like '%' || v_sent_label || '%'
    ) then
    return jsonb_build_object(
      'status',
      'skipped',
      'reason',
      'already_sent'
    );
  end if;

  v_audit_line := to_char(timezone('Europe/London', now()), 'DD/MM/YYYY')
    || ' - '
    || v_sent_label;

  if coalesce(trim(v_notes), '') = '' then
    v_notes := v_audit_line;
  else
    v_notes := trim(v_notes) || E'\n' || v_audit_line;
  end if;

  v_history_description := v_sent_label || ' recorded.';

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
    'reminder_sent',
    v_history_description
  )
  returning id, created_at
  into v_history_id, v_history_created_at;

  return jsonb_build_object(
    'status',
    'marked',
    'notes',
    v_notes,
    'history_entry',
    jsonb_build_object(
      'id',
      v_history_id,
      'action',
      'reminder_sent',
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

comment on function public.mark_reminder_sent(uuid, text) is
  'Append reminder-sent audit line and history entry for one compliance record (editor/admin).';

grant execute on function public.mark_reminder_sent(uuid, text) to authenticated;
