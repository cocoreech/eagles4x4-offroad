-- ============================================================
-- 0008 — RLS Hardening (additional policies & safety checks)
-- ============================================================
-- NOTE: Items 1, 2, 3 from the spec (audit_logs table + triggers,
-- WITH CHECK on UPDATE policies, profiles role-field block) were
-- already implemented in migration 0006_security_hardening_audit_notifications.
-- This migration adds items 4–12 and is intentionally additive: it does NOT
-- rewrite policy logic except where item 9 explicitly requires role-scoping.
--
-- File name: numbered 0008 because 0006 and 0007 were already
-- used; lexicographic ordering would have placed 0006_rls_hardening
-- before the audit-logs migration it depends on.

-- ============================================================
-- 4. INDEXES ON POLICY COLUMNS
-- ============================================================
-- Every column referenced in an RLS policy should have an index for
-- fast row filtering. Idempotent — re-creates only if missing.

-- vehicles.owner_id  → vehicles_select_own_or_admin / vehicles_insert_own
create index if not exists vehicles_owner_id_idx          on public.vehicles(owner_id);

-- bookings.customer_id  → bookings_* policies
create index if not exists bookings_customer_id_idx       on public.bookings(customer_id);
-- bookings.assigned_tech_id  → future tech-scoped policies
create index if not exists bookings_assigned_tech_idx     on public.bookings(assigned_tech_id);

-- booking_items.booking_id  → EXISTS subqueries in booking_items_* policies
create index if not exists booking_items_booking_id_idx   on public.booking_items(booking_id);

-- booking_status_history.booking_id  → history_select_via_booking
create index if not exists booking_history_booking_id_idx on public.booking_status_history(booking_id);

-- quotes.customer_id  → quotes_select_own_or_admin
create index if not exists quotes_customer_id_idx         on public.quotes(customer_id);

-- quote_items.quote_id  → EXISTS subqueries in quote_items_* policies
create index if not exists quote_items_quote_id_idx       on public.quote_items(quote_id);

-- event_rsvps.event_id / customer_id  → rsvps_* policies
create index if not exists event_rsvps_event_id_idx       on public.event_rsvps(event_id);
create index if not exists event_rsvps_customer_id_idx    on public.event_rsvps(customer_id);

-- notifications.user_id  → notifications_select_own_or_admin
create index if not exists notifications_user_id_idx      on public.notifications(user_id);

-- follow_up_logs.customer_id / booking_id  → follow_up_* policies
create index if not exists follow_up_customer_id_idx      on public.follow_up_logs(customer_id);
create index if not exists follow_up_booking_id_idx       on public.follow_up_logs(booking_id);

-- audit_logs.user_id  → admin lookups by actor
create index if not exists audit_logs_user_id_idx         on public.audit_logs(user_id);

-- media.uploaded_by  → media_admin_delete (uploader path)
create index if not exists media_uploaded_by_idx          on public.media(uploaded_by);

-- ============================================================
-- 5. VIEWS — SECURITY INVOKER NOTICE
-- ============================================================
-- No views currently exist in the public schema. Any future view that
-- exposes customer or booking data MUST be created with security_invoker = true
-- so it inherits the caller's RLS — not the view owner's bypass:
--
--   CREATE VIEW public.my_view WITH (security_invoker = true) AS ...;
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-invoker-on-views

-- ============================================================
-- 6. LOCK DOWN is_admin() FUNCTION (and other helpers)
-- ============================================================
-- All helpers explicitly reference public.<table> (qualified names),
-- so they remain functional when search_path is empty. Setting it
-- to '' is a hardening step: no schema-shadowing attack via search_path
-- manipulation is possible.

alter function public.is_admin()                  set search_path = '';
alter function public.handle_new_user()           set search_path = '';
alter function public.log_audit_event()           set search_path = '';
alter function public.set_updated_at()            set search_path = '';
alter function public.generate_booking_code()     set search_path = '';
alter function public.generate_quote_code()       set search_path = '';
alter function public.log_booking_status_change() set search_path = '';

-- Switch is_admin() from SECURITY DEFINER to SECURITY INVOKER.
-- The function reads public.profiles, which has the
-- profiles_select_own_or_admin policy — meaning the calling user can
-- always read their own row. So is_admin() works correctly as INVOKER
-- and the Supabase security advisor no longer flags it as a publicly
-- callable SECURITY DEFINER endpoint.
create or replace function public.is_admin()
returns boolean
language sql
stable security invoker set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','super_admin')
  );
$$;

-- is_admin() must be callable by RLS policies for real users.
grant execute on function public.is_admin() to anon, authenticated;

-- handle_new_user, log_audit_event, log_booking_status_change are called
-- only from triggers (which run as the trigger owner, not the caller).
-- Keep EXECUTE revoked so they cannot be invoked directly via RPC.
revoke execute on function public.handle_new_user()           from anon, authenticated, public;
revoke execute on function public.log_audit_event()           from anon, authenticated, public;
revoke execute on function public.log_booking_status_change() from anon, authenticated, public;

-- ============================================================
-- 7. STORAGE UUID CASTING (defensive note)
-- ============================================================
-- Our storage policies in migration 0006 already compare against
-- storage.objects.owner, which is a uuid column in modern Supabase —
-- no explicit cast is needed and the policies are correct.
--
-- The legacy storage.objects.owner_id column is text and DOES require a
-- cast when used. If a future policy references owner_id, use:
--   CAST(owner_id AS uuid) = (select auth.uid())
-- Otherwise PostgreSQL falls back to slow text comparison or fails.

-- ============================================================
-- 8. BLOCK auth.users EXPOSURE
-- ============================================================
-- Supabase PostgREST only exposes the schemas listed in its config
-- (default: public, storage, graphql). auth.users is not API-exposed by
-- default. Belt-and-suspenders: explicitly revoke all permissions so even
-- if someone widens the exposed schemas later, anon/authenticated still
-- cannot read auth.users directly.

revoke all on auth.users from anon, authenticated;

-- App code should always read user information through public.profiles
-- (which has RLS) — never auth.users directly.

-- ============================================================
-- 9. SCOPED PUBLIC POLICIES (no bare USING(true) without TO clause)
-- ============================================================
-- A bare USING(true) policy applies to ALL database roles, including any
-- new roles added later. Scoping with `TO anon, authenticated` makes the
-- intent explicit: only API roles get public read.

-- BUILDS — public read
drop policy if exists "builds_public_read" on public.builds;
create policy "builds_public_read_scoped"
  on public.builds for select
  to anon, authenticated
  using (true);

-- AVAILABILITY — public read
drop policy if exists "availability_public_read" on public.availability;
create policy "availability_public_read_scoped"
  on public.availability for select
  to anon, authenticated
  using (true);

-- SITE_CONTENT — public read
drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read_scoped"
  on public.site_content for select
  to anon, authenticated
  using (true);

-- SERVICES — public read of active items
drop policy if exists "services_public_read_active" on public.services;
create policy "services_public_read_active_scoped"
  on public.services for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

-- PRODUCTS — public read of active items
drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active_scoped"
  on public.products for select
  to anon, authenticated
  using (is_active = true or public.is_admin());

-- EVENTS — public read of published items
drop policy if exists "events_public_read_published" on public.events;
create policy "events_public_read_published_scoped"
  on public.events for select
  to anon, authenticated
  using (is_published = true or public.is_admin());

-- MEDIA — public read
drop policy if exists "media_public_read" on public.media;
create policy "media_public_read_scoped"
  on public.media for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 10. RLS / POLICY SAFETY CHECK QUERIES
-- ============================================================
-- Run these AFTER every future migration that touches schema or policies:
--
-- (a) Public tables with RLS disabled — should return zero rows:
--
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
--
-- (b) Public tables with RLS enabled but ZERO policies (effectively locked,
--     usually a mistake — should return zero rows):
--
--   SELECT t.tablename
--   FROM pg_tables t
--   LEFT JOIN pg_policies p
--     ON p.schemaname = t.schemaname AND p.tablename = t.tablename
--   WHERE t.schemaname = 'public'
--     AND t.rowsecurity = true
--     AND p.policyname IS NULL
--   GROUP BY t.tablename;
--
-- (c) Policies using bare USING(true) without role scoping — should return zero:
--
--   SELECT schemaname, tablename, policyname
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND qual = 'true'
--     AND (roles = '{public}' OR roles IS NULL);

-- ============================================================
-- 11. WARNING — NEVER USE auth.jwt() -> 'user_metadata' FOR ROLE CHECKS
-- ============================================================
-- user_metadata is writable by the user themselves through the auth API
-- (e.g. supabase.auth.updateUser({ data: { role: 'admin' } })) and can
-- therefore be forged. NEVER use it for authorization decisions.
--
-- Role checks MUST go through public.profiles.role via public.is_admin().
-- profiles.role is gated by the profiles_update_self_no_role_change policy
-- (added in migration 0006) so users cannot escalate themselves.
--
-- For app_metadata, only the service_role can update it — safer, but still
-- prefer public.profiles for consistency.
--
-- Reference: https://supabase.com/docs/guides/auth/managing-user-data

-- ============================================================
-- 12. POST-MIGRATION VERIFICATION CHECKLIST
-- ============================================================
-- After applying any RLS-related migration, manually verify:
--   [ ] RLS enabled on every public table (query 10a returns 0 rows)
--   [ ] No public table has RLS on with zero policies (query 10b returns 0 rows)
--   [ ] No policy uses bare USING(true) without an explicit TO clause (10c)
--   [ ] All storage buckets that are not meant to be world-readable are set
--       to "Private" in the Supabase dashboard
--   [ ] is_admin() has search_path = '' and EXECUTE granted only to anon +
--       authenticated (not public)
--   [ ] auth.users is not exposed via the PostgREST API (REVOKE applied)
--   [ ] No policy references auth.jwt() -> 'user_metadata' for role checks
--   [ ] Run security advisors via Supabase MCP — empty result
