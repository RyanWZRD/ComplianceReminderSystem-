-- v3.0.0 Alpha Phase 1: query indexes

create index people_organisation_id_idx on public.people (organisation_id);

create index compliance_records_organisation_id_idx
  on public.compliance_records (organisation_id);

create index compliance_records_person_id_idx
  on public.compliance_records (person_id);

create index compliance_records_expiry_date_idx
  on public.compliance_records (organisation_id, expiry_date);

create index history_entries_organisation_id_idx
  on public.history_entries (organisation_id);

create index history_entries_record_id_idx
  on public.history_entries (record_id);

create index evidence_items_organisation_id_idx
  on public.evidence_items (organisation_id);

create index evidence_items_record_id_idx
  on public.evidence_items (record_id);

create index actions_organisation_id_idx
  on public.actions (organisation_id);

create index actions_record_id_idx
  on public.actions (record_id);

create index actions_status_idx
  on public.actions (organisation_id, status);

create index deleted_record_snapshots_organisation_id_idx
  on public.deleted_record_snapshots (organisation_id);
