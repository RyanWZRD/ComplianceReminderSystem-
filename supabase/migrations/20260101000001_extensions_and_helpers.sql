-- v3.0.0 Alpha Phase 1: extensions and generic helpers
-- Profile-dependent RLS helpers are in 20260101000002 (after profiles table exists).

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
