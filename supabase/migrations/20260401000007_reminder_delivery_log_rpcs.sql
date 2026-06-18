-- V6 Phase 4: reminder delivery log RPCs (draft — no provider, delivery, or app wiring)

create or replace function public.create_reminder_delivery_log(
  p_organisation_id uuid,
  p_queue_item_id text,
  p_subject text,
  p_body_text text,
  p_delivery_status text,
  p_automation_run_id uuid default null,
  p_compliance_record_id uuid default null,
  p_person_id uuid default null,
  p_recipient_email text default null,
  p_prepared_at timestamptz default null,
  p_sent_at timestamptz default null,
  p_delivered_at timestamptz default null,
  p_failed_at timestamptz default null,
  p_failure_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_queue_item_id text;
  v_subject text;
  v_body_text text;
  v_delivery_status text;
  v_metadata jsonb;
  v_row public.reminder_delivery_logs%rowtype;
  v_allowed_statuses text[] := array['queued', 'prepared', 'sending', 'delivered', 'failed', 'cancelled'];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if public.current_user_role() <> 'admin' then
    raise exception 'Insufficient role to create reminder delivery logs'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  if p_organisation_id is distinct from v_org_id then
    raise exception 'Organisation mismatch'
      using errcode = '42501';
  end if;

  v_queue_item_id := nullif(trim(coalesce(p_queue_item_id, '')), '');

  if v_queue_item_id is null then
    raise exception 'Queue item id is required'
      using errcode = '22023';
  end if;

  v_subject := nullif(trim(coalesce(p_subject, '')), '');

  if v_subject is null then
    raise exception 'Subject is required'
      using errcode = '22023';
  end if;

  v_body_text := nullif(trim(coalesce(p_body_text, '')), '');

  if v_body_text is null then
    raise exception 'Body text is required'
      using errcode = '22023';
  end if;

  v_delivery_status := nullif(trim(coalesce(p_delivery_status, '')), '');

  if v_delivery_status is null then
    raise exception 'Delivery status is required'
      using errcode = '22023';
  end if;

  if not (v_delivery_status = any (v_allowed_statuses)) then
    raise exception 'Invalid delivery status'
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object'
      using errcode = '22023';
  end if;

  v_metadata := p_metadata;

  if p_automation_run_id is not null and not exists (
    select 1
    from public.automation_runs ar
    where ar.id = p_automation_run_id
      and ar.organisation_id = v_org_id
  ) then
    raise exception 'Automation run not found for organisation'
      using errcode = '22023';
  end if;

  if p_compliance_record_id is not null and not exists (
    select 1
    from public.compliance_records cr
    where cr.id = p_compliance_record_id
      and cr.organisation_id = v_org_id
  ) then
    raise exception 'Compliance record not found for organisation'
      using errcode = '22023';
  end if;

  if p_person_id is not null and not exists (
    select 1
    from public.people pe
    where pe.id = p_person_id
      and pe.organisation_id = v_org_id
  ) then
    raise exception 'Person not found for organisation'
      using errcode = '22023';
  end if;

  insert into public.reminder_delivery_logs (
    organisation_id,
    automation_run_id,
    queue_item_id,
    compliance_record_id,
    person_id,
    recipient_email,
    subject,
    body_text,
    delivery_status,
    prepared_at,
    sent_at,
    delivered_at,
    failed_at,
    failure_reason,
    metadata,
    created_by
  )
  values (
    v_org_id,
    p_automation_run_id,
    v_queue_item_id,
    p_compliance_record_id,
    p_person_id,
    nullif(trim(coalesce(p_recipient_email, '')), ''),
    v_subject,
    v_body_text,
    v_delivery_status,
    p_prepared_at,
    p_sent_at,
    p_delivered_at,
    p_failed_at,
    p_failure_reason,
    v_metadata,
    auth.uid()
  )
  returning *
  into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'delivery_status', v_row.delivery_status,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.get_reminder_delivery_logs(
  p_organisation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_logs jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if not public.has_org_role(array['admin', 'editor']) then
    raise exception 'Insufficient role to read reminder delivery logs'
      using errcode = '42501';
  end if;

  v_org_id := public.current_organisation_id();

  if v_org_id is null then
    raise exception 'No organisation on profile'
      using errcode = '42501';
  end if;

  if p_organisation_id is distinct from v_org_id then
    raise exception 'Organisation mismatch'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rdl.id,
        'organisation_id', rdl.organisation_id,
        'automation_run_id', rdl.automation_run_id,
        'queue_item_id', rdl.queue_item_id,
        'compliance_record_id', rdl.compliance_record_id,
        'person_id', rdl.person_id,
        'recipient_email', rdl.recipient_email,
        'subject', rdl.subject,
        'body_text', rdl.body_text,
        'delivery_status', rdl.delivery_status,
        'prepared_at', rdl.prepared_at,
        'sent_at', rdl.sent_at,
        'delivered_at', rdl.delivered_at,
        'failed_at', rdl.failed_at,
        'failure_reason', rdl.failure_reason,
        'metadata', rdl.metadata,
        'created_by', rdl.created_by,
        'created_at', rdl.created_at,
        'updated_at', rdl.updated_at
      )
      order by rdl.created_at desc
    ),
    '[]'::jsonb
  )
  into v_logs
  from public.reminder_delivery_logs rdl
  where rdl.organisation_id = v_org_id;

  return jsonb_build_object(
    'status', 'ok',
    'logs', v_logs
  );
end;
$$;

comment on function public.create_reminder_delivery_log(
  uuid, text, text, text, text, uuid, uuid, uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, jsonb
) is
  'Insert a reminder delivery log row (admin only; audit record only — no email sending).';

comment on function public.get_reminder_delivery_logs(uuid) is
  'List org reminder delivery logs newest first (admin + editor read).';

grant execute on function public.create_reminder_delivery_log(
  uuid, text, text, text, text, uuid, uuid, uuid, text, timestamptz, timestamptz, timestamptz, timestamptz, text, jsonb
) to authenticated;

grant execute on function public.get_reminder_delivery_logs(uuid)
  to authenticated;
