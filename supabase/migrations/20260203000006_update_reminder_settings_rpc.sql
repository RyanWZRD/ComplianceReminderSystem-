-- Phase 3 Step 2: organisation reminder settings (admin only)

create or replace function public.update_reminder_settings(
  p_days_30 boolean,
  p_days_14 boolean,
  p_days_7 boolean,
  p_hide_sent_reminders boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if public.current_user_role() <> 'admin' then
    raise exception 'Insufficient role to update reminder settings'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  insert into public.reminder_settings (
    organisation_id,
    days_30,
    days_14,
    days_7,
    hide_sent_reminders
  )
  values (
    v_org_id,
    coalesce(p_days_30, true),
    coalesce(p_days_14, true),
    coalesce(p_days_7, true),
    coalesce(p_hide_sent_reminders, false)
  )
  on conflict (organisation_id) do update
  set
    days_30 = coalesce(p_days_30, true),
    days_14 = coalesce(p_days_14, true),
    days_7 = coalesce(p_days_7, true),
    hide_sent_reminders = coalesce(p_hide_sent_reminders, false),
    updated_at = now();

  return jsonb_build_object('status', 'updated');
end;
$$;

comment on function public.update_reminder_settings(boolean, boolean, boolean, boolean) is
  'Upsert organisation reminder window settings (admin only).';

grant execute on function public.update_reminder_settings(boolean, boolean, boolean, boolean)
  to authenticated;
