-- v3.0.0 Alpha Phase 1 seed data (synthetic — no real PII)
-- Runs as superuser on supabase db reset; bypasses RLS.
-- Profiles are NOT seeded here — create auth users manually (see docs/cloud-setup.md).

insert into public.organisations (id, name, slug)
values (
  '11111111-1111-1111-1111-111111111111',
  'Alpha Test Organisation',
  'alpha-test-org'
);

insert into public.reminder_settings (
  organisation_id,
  days_30,
  days_14,
  days_7,
  hide_sent_reminders
)
values (
  '11111111-1111-1111-1111-111111111111',
  true,
  true,
  true,
  false
);

insert into public.people (id, organisation_id, name, role)
values
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'Alex Volunteer',
    'Volunteer'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'Jordan Coordinator',
    'Coordinator'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111111',
    'Sam Priest',
    'Clergy'
  ),
  (
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111111',
    'Taylor Warden',
    'Church Warden'
  ),
  (
    '22222222-2222-2222-2222-222222222205',
    '11111111-1111-1111-1111-111111111111',
    'Riley Safeguarding',
    'Safeguarding Officer'
  );

insert into public.compliance_records (
  id,
  organisation_id,
  person_id,
  compliance_type,
  expiry_date,
  renewal_cycle,
  notes
)
values
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'DBS',
    (current_date + interval '45 days')::date,
    '3-years',
    'Sample valid record with upcoming expiry.'
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222202',
    'Basic Awareness',
    (current_date + interval '20 days')::date,
    '3-years',
    'Due soon window.'
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222203',
    'Leadership',
    (current_date - interval '5 days')::date,
    '3-years',
    'Expired sample record.'
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222204',
    'DBS',
    (current_date + interval '120 days')::date,
    '3-years',
    'Valid with evidence below.'
  ),
  (
    '33333333-3333-3333-3333-333333333305',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222205',
    'Foundations',
    (current_date + interval '60 days')::date,
    '1-year',
    'Record with open and overdue actions.'
  ),
  (
    '33333333-3333-3333-3333-333333333306',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222201',
    'First Aid',
    (current_date + interval '200 days')::date,
    'manual',
    'Second record for same person.'
  );

insert into public.history_entries (
  id,
  organisation_id,
  record_id,
  actor_display_name,
  action,
  description,
  created_at
)
values
  (
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333301',
    'Seed Import',
    'created',
    'Record created (DBS, seed data).',
    now() - interval '30 days'
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    'Seed Import',
    'evidence_added',
    'Evidence added: DBS Certificate.',
    now() - interval '10 days'
  );

insert into public.evidence_items (
  id,
  organisation_id,
  record_id,
  name,
  document_type,
  notes,
  added_date,
  file_name,
  file_migrated
)
values
  (
    '55555555-5555-5555-5555-555555555501',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    'DBS Certificate Scan',
    'DBS Certificate',
    'Metadata only in alpha — no Storage file yet.',
    (current_date - interval '400 days')::date,
    'dbs-sample.pdf',
    false
  ),
  (
    '55555555-5555-5555-5555-555555555502',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    'Training Certificate',
    'Training Certificate',
    'Stale evidence sample (>12 months).',
    (current_date - interval '500 days')::date,
    'training-sample.pdf',
    false
  );

insert into public.actions (
  id,
  organisation_id,
  record_id,
  title,
  status,
  completed,
  due_date,
  owner,
  notes,
  created_at,
  completed_at
)
values
  (
    '66666666-6666-6666-6666-666666666601',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333305',
    'Chase renewal paperwork',
    'open',
    false,
    (current_date - interval '3 days')::date,
    'Safeguarding Officer',
    'Overdue open action.',
    now() - interval '14 days',
    null
  ),
  (
    '66666666-6666-6666-6666-666666666602',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333305',
    'Book training session',
    'in_progress',
    false,
    (current_date + interval '7 days')::date,
    'Coordinator',
    'In progress action.',
    now() - interval '7 days',
    null
  ),
  (
    '66666666-6666-6666-6666-666666666603',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333303',
    'Renew expired certificate',
    'completed',
    true,
    (current_date - interval '10 days')::date,
    'Clergy',
    'Completed action on expired record.',
    now() - interval '20 days',
    now() - interval '2 days'
  );

insert into public.deleted_record_snapshots (
  id,
  organisation_id,
  deleted_at,
  person_name,
  person_role,
  record_snapshot
)
values (
  '77777777-7777-7777-7777-777777777701',
  '11111111-1111-1111-1111-111111111111',
  now() - interval '90 days',
  'Former Volunteer',
  'Volunteer',
  jsonb_build_object(
    'id', 9999,
    'complianceType', 'DBS',
    'expiryDate', (current_date - interval '365 days')::text,
    'renewalCycle', '3-years',
    'notes', 'Archived sample snapshot.',
    'history', '[]'::jsonb,
    'evidence', '[]'::jsonb,
    'actions', '[]'::jsonb
  )
);
