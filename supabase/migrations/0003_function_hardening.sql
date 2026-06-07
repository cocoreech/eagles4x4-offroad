-- ============================================================
-- Function hardening — lock search_path + revoke public RPC
-- Migration 0003
-- ============================================================

-- Lock search_path on all helper functions
alter function public.set_updated_at()           set search_path = public;
alter function public.generate_booking_code()    set search_path = public;
alter function public.generate_quote_code()      set search_path = public;
alter function public.log_booking_status_change() set search_path = public;

-- Revoke RPC access on SECURITY DEFINER functions
-- handle_new_user is meant for the auth trigger only — no client should call it
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- is_admin is only meant for RLS policies — no client RPC needed
revoke execute on function public.is_admin() from anon, authenticated, public;
