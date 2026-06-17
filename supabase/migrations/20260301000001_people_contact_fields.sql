-- V5-1A Phase 2: nullable person contact columns + email validation helpers

alter table public.people
  add column if not exists email text,
  add column if not exists manager_email text;

comment on column public.people.email is
  'Optional person contact email (lowercase, trimmed). Null when unset.';

comment on column public.people.manager_email is
  'Optional manager contact email (lowercase, trimmed). Null when unset.';

create or replace function public.normalize_email(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then null
    else nullif(lower(trim(p_value)), '')
  end;
$$;

comment on function public.normalize_email(text) is
  'Trim, lowercase, and map blank input to null for optional email storage.';

create or replace function public.is_valid_email(p_value text)
returns boolean
language sql
immutable
as $$
  select case
    when public.normalize_email(p_value) is null then true
    else public.normalize_email(p_value) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  end;
$$;

comment on function public.is_valid_email(text) is
  'True when value is null/blank or matches the practical email format check.';
