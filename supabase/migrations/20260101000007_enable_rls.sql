-- v3.0.0 Alpha Phase 1: enable row level security

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.compliance_records enable row level security;
alter table public.history_entries enable row level security;
alter table public.evidence_items enable row level security;
alter table public.actions enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.deleted_record_snapshots enable row level security;
