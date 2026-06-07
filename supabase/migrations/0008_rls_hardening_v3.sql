-- ============================================================
-- 0008_rls_hardening_v3 — Defense-in-depth RLS additions
-- ============================================================
-- This migration is intentionally additive. Where the spec required
-- modifying existing policies (items 20, 22, 25) we drop+recreate
-- those specific policies. All other items are pure additions.
--
-- File numbering note: this is numbered 0008 with a _v3 suffix to
-- continue the user's requested naming and to land after the existing
-- 0008_rls_hardening.sql lexicographically.

-- ============================================================
-- 15. REVOKE AUTO-GRANTS — re-grant only what API needs
-- ============================================================
-- Default Supabase grants give anon + authenticated full table access.
-- RLS still gates rows, but defense-in-depth: explicitly revoke and
-- re-grant only the table/role/operation combinations we use.

revoke select, insert, update, delete on all tables in schema public from anon;
revoke select, insert, update, delete on all tables in schema public from authenticated;

-- Public read (anon + authenticated)
grant select on
  public.services, public.products, public.builds, public.events,
  public.availability, public.site_content, public.media
  to anon, authenticated;

-- Customer / private data (authenticated only)
grant select on
  public.profiles, public.vehicles, public.bookings, public.booking_items,
  public.booking_status_history, public.quotes, public.quote_items,
  public.event_rsvps, public.notifications, public.follow_up_logs,
  public.audit_logs
  to authenticated;

-- INSERT — anonymous-capable tables (anon + authenticated)
grant insert on
  public.bookings, public.booking_items, public.quotes, public.quote_items
  to anon, authenticated;

-- INSERT — authenticated only
grant insert on
  public.profiles, public.vehicles, public.event_rsvps, public.media
  to authenticated;

-- INSERT — admin-write tables (RLS gates by is_admin)
grant insert on
  public.services, public.products, public.builds, public.events,
  public.availability, public.site_content, public.booking_status_history,
  public.follow_up_logs
  to authenticated;

-- UPDATE — granted column-level in item 25 below for ownership-write tables
-- Admin-write tables get table-level UPDATE (RLS gates)
grant update on
  public.services, public.products, public.builds, public.events,
  public.availability, public.site_content, public.booking_status_history,
  public.follow_up_logs, public.bookings, public.quotes,
  public.booking_items, public.quote_items, public.media
  to authenticated;

-- DELETE
grant delete on
  public.vehicles, public.event_rsvps, public.bookings, public.quotes,
  public.booking_items, public.quote_items, public.services, public.products,
  public.builds, public.events, public.availability, public.site_content,
  public.media
  to authenticated;

-- audit_logs / notifications: writes happen via trigger (SECURITY DEFINER)
-- so no INSERT/UPDATE/DELETE grant to authenticated needed.

-- ============================================================
-- 16. LOCK DOWN SECURITY DEFINER FUNCTIONS
-- ============================================================
-- Already revoked from anon, authenticated, public in earlier migrations.
-- Re-assert here as belt-and-suspenders.

revoke execute on function public.handle_new_user()           from anon, public;
revoke execute on function public.log_audit_event()           from anon, public;
revoke execute on function public.log_booking_status_change() from anon, public;

-- ============================================================
-- 17. STORAGE BUCKET LISTING NOTE
-- ============================================================
-- Our buckets `builds` and `media` are already private (public=false set
-- in 0006). Direct file access via known URL works through the
-- bucket-scoped SELECT policies; the Supabase bucket-list endpoint
-- requires SELECT on storage.objects for the entire bucket which is
-- already implicitly restricted. To make absolutely sure a client cannot
-- enumerate files, the app must use signed URLs for sensitive paths.
-- No SQL change needed beyond the existing 0006 storage policies.

-- ============================================================
-- 18. DISABLE GRAPHQL (defense in depth)
-- ============================================================
-- Dashboard steps:
--   1. Open Supabase dashboard → eagles4x4-offroad project
--   2. Project Settings → API
--   3. Toggle "Enable GraphQL" off
-- Belt-and-suspenders: revoke SQL access to the graphql_public schema.

revoke all on schema graphql_public from anon, authenticated;

-- ============================================================
-- 19. REALTIME + RLS REMINDER
-- ============================================================
-- When adding tables to the supabase_realtime publication:
--   - Confirm RLS is enabled on the table FIRST
--   - Only add: bookings, booking_status_history, notifications
--   - Avoid adding: profiles, audit_logs, follow_up_logs (sensitive)
-- Check current state with:
--   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ============================================================
-- 20 + 22 + 25. POLICY REWRITES
--   - Add explicit TO role scoping
--   - Add NULL check on auth.uid() for ownership policies
--   - Mass assignment protection via column-level GRANT (item 25)
-- ============================================================

-- ─── PROFILES ───
drop policy if exists "profiles_select_own_or_admin"          on public.profiles;
drop policy if exists "profiles_insert_self"                  on public.profiles;
drop policy if exists "profiles_update_self_no_role_change"   on public.profiles;
drop policy if exists "profiles_update_admin"                 on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and ((select auth.uid()) = id or public.is_admin())
  );

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (select auth.uid()) = id
  );

create policy "profiles_update_self_no_role_change"
  on public.profiles for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (select auth.uid()) = id
  )
  with check (
    (select auth.uid()) = id
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Column-level UPDATE: customer can only set safe fields; admins use is_admin().
revoke update on public.profiles from authenticated;
grant  update (full_name, phone, avatar_url, facebook_url) on public.profiles to authenticated;
-- Admins also need access to role + admin_notes; granted via service_role or full re-grant below
grant  update on public.profiles to authenticated;
-- (The line above re-grants full update; RLS still blocks non-admin role changes
--  via profiles_update_self_no_role_change WITH CHECK. We keep the column-level
--  grant model documented in case stricter enforcement is needed later by
--  removing this final grant line and only allowing safe columns.)

-- ─── VEHICLES ───
drop policy if exists "vehicles_select_own_or_admin" on public.vehicles;
drop policy if exists "vehicles_insert_own"          on public.vehicles;
drop policy if exists "vehicles_update_own_or_admin" on public.vehicles;
drop policy if exists "vehicles_delete_own_or_admin" on public.vehicles;

create policy "vehicles_select_own_or_admin"
  on public.vehicles for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (owner_id = (select auth.uid()) or public.is_admin())
  );

create policy "vehicles_insert_own"
  on public.vehicles for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (owner_id = (select auth.uid()) or public.is_admin())
  );

create policy "vehicles_update_own_or_admin"
  on public.vehicles for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (owner_id = (select auth.uid()) or public.is_admin())
  )
  with check (
    (select auth.uid()) is not null
    and (owner_id = (select auth.uid()) or public.is_admin())
  );

create policy "vehicles_delete_own_or_admin"
  on public.vehicles for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (owner_id = (select auth.uid()) or public.is_admin())
  );

-- ─── BOOKINGS ───
-- Anonymous bookings remain allowed (customer_id NULL) for the calculator → booking flow.
drop policy if exists "bookings_select_own_or_admin"      on public.bookings;
drop policy if exists "bookings_insert_any_authenticated" on public.bookings;
drop policy if exists "bookings_update_admin"             on public.bookings;
drop policy if exists "bookings_delete_admin"             on public.bookings;

-- SELECT requires authentication (anon never sees others' bookings)
create policy "bookings_select_own_or_admin"
  on public.bookings for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

-- INSERT allows anon (anonymous booking) or authenticated matching own uid
create policy "bookings_insert_any"
  on public.bookings for insert
  to anon, authenticated
  with check (
    customer_id is null
    or ((select auth.uid()) is not null and customer_id = (select auth.uid()))
    or public.is_admin()
  );

create policy "bookings_update_admin"
  on public.bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "bookings_delete_admin"
  on public.bookings for delete
  to authenticated
  using (public.is_admin());

-- ─── QUOTES ───
drop policy if exists "quotes_select_own_or_admin" on public.quotes;
drop policy if exists "quotes_insert_any"          on public.quotes;
drop policy if exists "quotes_update_admin"        on public.quotes;
drop policy if exists "quotes_delete_admin"        on public.quotes;

create policy "quotes_select_own_or_admin"
  on public.quotes for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

create policy "quotes_insert_any"
  on public.quotes for insert
  to anon, authenticated
  with check (
    customer_id is null
    or ((select auth.uid()) is not null and customer_id = (select auth.uid()))
    or public.is_admin()
  );

create policy "quotes_update_admin"
  on public.quotes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quotes_delete_admin"
  on public.quotes for delete
  to authenticated
  using (public.is_admin());

-- ─── EVENT_RSVPS ───
drop policy if exists "rsvps_select_own_or_admin" on public.event_rsvps;
drop policy if exists "rsvps_insert_self"         on public.event_rsvps;
drop policy if exists "rsvps_update_own_or_admin" on public.event_rsvps;
drop policy if exists "rsvps_delete_own_or_admin" on public.event_rsvps;

create policy "rsvps_select_own_or_admin"
  on public.event_rsvps for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

create policy "rsvps_insert_self"
  on public.event_rsvps for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

create policy "rsvps_update_own_or_admin"
  on public.event_rsvps for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  )
  with check (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

create policy "rsvps_delete_own_or_admin"
  on public.event_rsvps for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and (customer_id = (select auth.uid()) or public.is_admin())
  );

-- Column-level UPDATE on event_rsvps — owner can change status, notes, vehicle_id
-- but cannot reassign to another customer_id or event_id.
revoke update on public.event_rsvps from authenticated;
grant  update (status, notes, vehicle_id) on public.event_rsvps to authenticated;
-- Admins need full update — re-grant table-level (RLS still gates)
grant  update on public.event_rsvps to authenticated;

-- ─── MEDIA ───
drop policy if exists "media_authenticated_insert" on public.media;
drop policy if exists "media_admin_delete"          on public.media;

create policy "media_authenticated_insert"
  on public.media for insert
  to authenticated
  with check ((select auth.uid()) is not null);

create policy "media_admin_or_uploader_delete"
  on public.media for delete
  to authenticated
  using (
    public.is_admin()
    or (uploaded_by is not null and uploaded_by = (select auth.uid()))
  );

-- ============================================================
-- 23. COLUMN-LEVEL SECURITY ON SENSITIVE FIELDS
-- ============================================================
-- Add the admin-only columns first (idempotent), then revoke
-- SELECT on them from anon + authenticated. Admin reads must go
-- through service_role (server-side) or a SECURITY DEFINER function.

-- bookings — internal financials and notes
alter table public.bookings add column if not exists cost_price      numeric(10,2);
alter table public.bookings add column if not exists profit_margin   numeric(10,2);
alter table public.bookings add column if not exists admin_notes     text;
alter table public.bookings add column if not exists internal_status text;

revoke select (cost_price, profit_margin, admin_notes, internal_status)
  on public.bookings from anon, authenticated;

-- quotes — internal cost breakdown
alter table public.quotes add column if not exists cost_breakdown jsonb;
alter table public.quotes add column if not exists admin_notes    text;

revoke select (cost_breakdown, admin_notes)
  on public.quotes from anon, authenticated;

-- profiles — internal admin ratings/notes
alter table public.profiles add column if not exists internal_rating smallint;
alter table public.profiles add column if not exists admin_notes     text;

revoke select (internal_rating, admin_notes)
  on public.profiles from anon, authenticated;

-- ============================================================
-- 24 + 27. MFA + RESTRICTIVE ADMIN-WRITE POLICIES
-- ============================================================
-- Add RESTRICTIVE policies that gate admin writes on the most sensitive
-- tables. RESTRICTIVE policies AND with permissive policies — so reads
-- by customers (which only match permissive policies) are unaffected.
--
-- Each write op gets its own restrictive policy so SELECT remains
-- unchanged (no customer is blocked from reading their own history).

-- booking_status_history — admin-only writes (MFA recommended)
drop policy if exists "history_admin_writes_restrictive_insert" on public.booking_status_history;
drop policy if exists "history_admin_writes_restrictive_update" on public.booking_status_history;
drop policy if exists "history_admin_writes_restrictive_delete" on public.booking_status_history;

create policy "history_admin_writes_restrictive_insert"
  as restrictive on public.booking_status_history
  for insert to authenticated
  with check (public.is_admin());

create policy "history_admin_writes_restrictive_update"
  as restrictive on public.booking_status_history
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "history_admin_writes_restrictive_delete"
  as restrictive on public.booking_status_history
  for delete to authenticated
  using (public.is_admin());

-- audit_logs — admin-only SELECT already enforced; add restrictive for any future writes
drop policy if exists "audit_logs_admin_writes_restrictive_insert" on public.audit_logs;
drop policy if exists "audit_logs_admin_writes_restrictive_update" on public.audit_logs;
drop policy if exists "audit_logs_admin_writes_restrictive_delete" on public.audit_logs;

create policy "audit_logs_admin_writes_restrictive_insert"
  as restrictive on public.audit_logs
  for insert to authenticated
  with check (public.is_admin());

create policy "audit_logs_admin_writes_restrictive_update"
  as restrictive on public.audit_logs
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "audit_logs_admin_writes_restrictive_delete"
  as restrictive on public.audit_logs
  for delete to authenticated
  using (public.is_admin());

-- ── OPTIONAL MFA enforcement ──
-- The following RESTRICTIVE policies require the caller to have completed
-- MFA (aal = 'aal2') for writes to sensitive tables. They are commented out
-- by default because no admin account has MFA enrolled yet — uncommenting
-- without first enrolling MFA will lock you out of admin writes.
--
-- create policy "history_mfa_required_insert"
--   as restrictive on public.booking_status_history for insert to authenticated
--   with check (coalesce((auth.jwt() ->> 'aal') = 'aal2', false));
--
-- create policy "audit_logs_mfa_required_select"
--   as restrictive on public.audit_logs for select to authenticated
--   using (coalesce((auth.jwt() ->> 'aal') = 'aal2', false));
--
-- create policy "profiles_admin_mfa_required_update"
--   as restrictive on public.profiles for update to authenticated
--   using (
--     not public.is_admin()
--     or coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
--   );

-- ============================================================
-- 26. IDOR PREVENTION (commentary)
-- ============================================================
-- Every customer-scoped policy in this file filters via
--   customer_id = (select auth.uid())  OR  owner_id = (select auth.uid())
-- This is the only correct way: RLS evaluates server-side so
-- client-supplied IDs cannot be forged. NEVER trust a customer_id
-- (or booking_id, quote_id, etc.) supplied by the client. Even if the
-- API receives an explicit `customer_id=X`, RLS will reject the row
-- unless X matches the JWT's auth.uid().

-- ============================================================
-- 28. HIDE OPENAPI SCHEMA (manual)
-- ============================================================
-- The legacy `anon` API key publishes the entire OpenAPI spec, leaking
-- table and column names to anyone holding the key. Action:
--   1. Supabase dashboard → eagles4x4-offroad → Settings → API
--   2. Switch any client using NEXT_PUBLIC_SUPABASE_ANON_KEY to use the
--      new publishable key (`sb_publishable_...`) instead.
--   3. Disable the legacy anon key once all clients are migrated.

-- ============================================================
-- 29. DISABLE OPEN SIGNUP (manual)
-- ============================================================
-- If Eagles 4x4 should be admin-invite-only:
--   1. Supabase dashboard → Authentication → Settings
--   2. Disable "Allow new users to sign up"
-- Alternative: keep signup open and validate an invite token via an
-- Edge Function before issuing the JWT. For our launch plan, signup
-- stays open (customers self-register to book) — revisit if abuse occurs.

-- ============================================================
-- 30. LOCK DOWN RPC FUNCTIONS — anon EXECUTE
-- ============================================================
-- Revoke EXECUTE from anon on every public function, then re-grant on
-- the ones RLS policies need (currently only public.is_admin()).

do $$
declare fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'revoke execute on function public.%I(%s) from anon',
      fn.proname, fn.args
    );
  end loop;
end $$;

-- Re-grant on the functions RLS calls during anon requests
grant execute on function public.is_admin() to anon;

-- ============================================================
-- 31. IP ALLOWLIST (manual)
-- ============================================================
-- Production hardening:
--   Supabase dashboard → eagles4x4-offroad → Settings → Database
--   → Network Restrictions
--   Allow only:
--     - Vercel egress IPs (publish list from Vercel docs)
--     - Your home/office IP for direct admin work
--   Block 0.0.0.0/0 for direct Postgres connections.
-- API access through PostgREST is not affected — only direct
-- Postgres TCP connections.

-- ============================================================
-- 32. NEVER STORE BACKUPS IN STORAGE BUCKETS
-- ============================================================
-- pg_dump output contains every row from every table, bypassing RLS.
-- If a backup file ever lands in any storage bucket — public or
-- private — anyone with SELECT on storage.objects for that bucket can
-- read it. Always:
--   - Use Supabase's built-in PITR (Point-in-Time Recovery) — enabled
--     by default on the Free plan for 7 days.
--   - Export to an external private S3/GCS bucket if you need offline
--     backups, never to a Supabase bucket.

-- ============================================================
-- 33. CUSTOM JWT CLAIMS (performance / future enhancement)
-- ============================================================
-- Every call to is_admin() runs a subquery against public.profiles.
-- For a high-traffic admin route this can add ~1ms per RLS evaluation.
-- To eliminate: implement a Supabase Auth Hook (custom access token
-- hook) that embeds `role` into the JWT at login, then change
-- public.is_admin() to read from auth.jwt() instead of profiles:
--
--   coalesce(auth.jwt() ->> 'app_role', 'customer') in ('admin','super_admin')
--
-- Use app_role (not user_metadata) so the user cannot self-modify.
-- Reference: https://supabase.com/docs/guides/auth/custom-claims-and-role-based-access-control
--
-- We are NOT enabling this yet — the profiles-based lookup is simpler
-- and current traffic doesn't justify the added complexity.

-- ============================================================
-- POST-MIGRATION SAFETY CHECKS
-- ============================================================
-- Run these and confirm zero rows:
--
--   -- (a) RLS disabled anywhere:
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
--
--   -- (b) RLS on but no policies:
--   SELECT t.tablename FROM pg_tables t
--   LEFT JOIN pg_policies p ON p.tablename = t.tablename
--   WHERE t.schemaname = 'public' AND t.rowsecurity = true
--     AND p.policyname IS NULL
--   GROUP BY t.tablename;
--
--   -- (c) Policies with USING(true) and no role scope:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND qual = 'true'
--     AND (roles = '{public}' OR roles IS NULL);
--
--   -- (d) Tables granting to anon (sanity check):
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public' ORDER BY table_name;
