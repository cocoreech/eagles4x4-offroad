-- ============================================================
-- 0018 — Restore is_admin() to SECURITY DEFINER
-- ============================================================
-- Migration 0008 switched is_admin() to SECURITY INVOKER to satisfy the
-- Supabase security advisor (publicly-callable SECURITY DEFINER warning).
-- This caused infinite RLS recursion: profiles policies call is_admin(),
-- which (as INVOKER) SELECTs profiles, which re-evaluates the policy → 54001.
--
-- The correct fix is SECURITY DEFINER with a locked search_path (already
-- standard Supabase practice). With search_path = '', schema-shadowing
-- attacks are impossible. The function is read-only and always scoped to
-- auth.uid() — there is nothing to escalate.

create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','super_admin')
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
