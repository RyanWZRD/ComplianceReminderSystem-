-- v3.0.0 Alpha Phase 1 corrective migration
-- Restrict reminder_settings writes to admin only (explicit role check).
-- Restore seed org days_7 after any failed RLS test.

alter table public.reminder_settings enable row level security;

drop policy if exists reminder_settings_select_member on public.reminder_settings;
drop policy if exists reminder_settings_admin_update on public.reminder_settings;
drop policy if exists reminder_settings_admin_insert on public.reminder_settings;

-- SELECT: admin, editor, viewer (same organisation)
create policy reminder_settings_select_member
on public.reminder_settings
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() in ('admin', 'editor', 'viewer')
);

-- UPDATE: admin only
create policy reminder_settings_update_admin
on public.reminder_settings
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() = 'admin'
)
with check (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() = 'admin'
);

-- INSERT: admin only (org setup)
create policy reminder_settings_insert_admin
on public.reminder_settings
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.current_user_role() = 'admin'
);

-- No UPDATE/INSERT policies for editor or viewer (default deny under RLS).

-- Restore alpha seed reminder setting
update public.reminder_settings
set
  days_7 = true,
  updated_at = now()
where organisation_id = '11111111-1111-1111-1111-111111111111';
