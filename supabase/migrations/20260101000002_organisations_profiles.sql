-- v3.0.0 Alpha Phase 1: platform tables

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

create index profiles_organisation_id_idx on public.profiles (organisation_id);

comment on table public.organisations is 'Tenant boundary for multi-user cloud mode.';
comment on table public.profiles is 'Links Supabase Auth users to an organisation and role.';

-- RLS helper functions (require public.profiles)
create or replace function public.current_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_org_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
  )
$$;

create or replace function public.has_org_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role = any (allowed_roles)
      from public.profiles
      where id = auth.uid()
    ),
    false
  )
$$;

comment on function public.current_organisation_id() is
  'Returns the organisation_id for the authenticated user profile.';

comment on function public.current_user_role() is
  'Returns admin, editor, or viewer for the authenticated user profile.';
