-- v3.0.0 Alpha Phase 1: row level security policies
-- Roles: admin, editor, viewer (see profiles.role)
-- Viewer: SELECT only
-- Editor: SELECT + INSERT/UPDATE/DELETE on operational data
-- Admin: editor rights + reminder_settings + profile role management

-- organisations
create policy organisations_select_member
on public.organisations
for select
to authenticated
using (id = public.current_organisation_id());

-- profiles
create policy profiles_select_same_org
on public.profiles
for select
to authenticated
using (organisation_id = public.current_organisation_id());

create policy profiles_update_self_display_name
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and organisation_id = public.current_organisation_id()
  and role = (select role from public.profiles where id = auth.uid())
);

create policy profiles_admin_manage
on public.profiles
for all
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

-- people
create policy people_select_member
on public.people
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy people_editor_write
on public.people
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy people_editor_update
on public.people
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy people_editor_delete
on public.people
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

-- compliance_records
create policy compliance_records_select_member
on public.compliance_records
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy compliance_records_editor_insert
on public.compliance_records
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy compliance_records_editor_update
on public.compliance_records
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy compliance_records_editor_delete
on public.compliance_records
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

-- history_entries (append-only for editors)
create policy history_entries_select_member
on public.history_entries
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy history_entries_editor_insert
on public.history_entries
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

-- evidence_items
create policy evidence_items_select_member
on public.evidence_items
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy evidence_items_editor_insert
on public.evidence_items
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy evidence_items_editor_update
on public.evidence_items
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy evidence_items_editor_delete
on public.evidence_items
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

-- actions
create policy actions_select_member
on public.actions
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy actions_editor_insert
on public.actions
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy actions_editor_update
on public.actions
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy actions_editor_delete
on public.actions
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

-- reminder_settings
create policy reminder_settings_select_member
on public.reminder_settings
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy reminder_settings_admin_update
on public.reminder_settings
for update
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
)
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

create policy reminder_settings_admin_insert
on public.reminder_settings
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);

-- deleted_record_snapshots
create policy deleted_record_snapshots_select_member
on public.deleted_record_snapshots
for select
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor', 'viewer'])
);

create policy deleted_record_snapshots_editor_insert
on public.deleted_record_snapshots
for insert
to authenticated
with check (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin', 'editor'])
);

create policy deleted_record_snapshots_admin_delete
on public.deleted_record_snapshots
for delete
to authenticated
using (
  organisation_id = public.current_organisation_id()
  and public.has_org_role(array['admin'])
);
