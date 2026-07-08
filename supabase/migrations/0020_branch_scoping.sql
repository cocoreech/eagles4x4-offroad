-- ============================================================
-- 0020 — Multi-branch scoping
-- ============================================================
-- Customers pick a branch when booking (only 'cavite' is actually
-- selectable in the app right now — enforced there, not here, so this
-- stays forward-compatible when the other branches go live). Each
-- non-super admin account is assigned to exactly one branch (set on
-- their first admin login, via profiles.branch) and can only see/manage
-- bookings for that branch. super_admin is unrestricted.
--
-- Branch slugs must stay in sync with src/content/branches.ts:
--   cavite | taguig | quezon-city | valenzuela

-- ── bookings.branch ──────────────────────────────────────────
-- NOT NULL with a default so existing rows (all pre-dating multi-branch,
-- i.e. all actually Cavite bookings) backfill cleanly in the same ALTER.
alter table public.bookings
  add column branch text not null default 'cavite'
  check (branch in ('cavite', 'taguig', 'quezon-city', 'valenzuela'));

-- ── profiles.branch ──────────────────────────────────────────
-- Nullable: null means "not yet assigned" for an admin, or simply
-- not-applicable for super_admin / customer roles.
alter table public.profiles
  add column branch text
  check (branch is null or branch in ('cavite', 'taguig', 'quezon-city', 'valenzuela'));

-- ── is_super_admin() ─────────────────────────────────────────
-- Mirrors is_admin()'s SECURITY DEFINER + locked search_path pattern (0018).
-- Distinct from is_admin() (true for admin OR super_admin) — this is
-- specifically for "unrestricted across all branches."
create or replace function public.is_super_admin()
returns boolean
language sql
stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;
grant execute on function public.is_super_admin() to anon, authenticated;

-- ── admin_branch() ───────────────────────────────────────────
-- The calling admin's own assigned branch (or null). Used inline in the
-- policies below instead of repeating the subquery everywhere.
create or replace function public.admin_branch()
returns text
language sql
stable security definer set search_path = ''
as $$
  select branch from public.profiles where id = auth.uid();
$$;
-- Only signed-in users need this (it's self-scoped via auth.uid() anyway,
-- but there's no reason for anon to call it at all). Postgres grants EXECUTE
-- to PUBLIC by default on function creation — revoke that explicitly.
grant execute on function public.admin_branch() to authenticated;
revoke execute on function public.admin_branch() from public, anon;

-- ── bookings: SELECT/UPDATE/DELETE scoped to the admin's own branch ──
-- Customers keep seeing their own bookings regardless of branch (that part
-- is unchanged). super_admin bypasses the branch check entirely.
drop policy if exists "bookings_select_own_or_admin" on public.bookings;
create policy "bookings_select_own_or_admin"
  on public.bookings for select
  using (
    (select auth.uid()) is not null
    and (
      customer_id = (select auth.uid())
      or public.is_super_admin()
      or (public.is_admin() and branch = public.admin_branch())
    )
  );

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin"
  on public.bookings for update
  to authenticated
  using (public.is_super_admin() or (public.is_admin() and branch = public.admin_branch()))
  with check (public.is_super_admin() or (public.is_admin() and branch = public.admin_branch()));

drop policy if exists "bookings_delete_admin" on public.bookings;
create policy "bookings_delete_admin"
  on public.bookings for delete
  using (public.is_super_admin() or (public.is_admin() and branch = public.admin_branch()));

-- INSERT: guest/self-checkout paths (customer_id is null, or = auth.uid())
-- are completely untouched by branch — only the admin-on-behalf-of-someone
-- path gets scoped, so a branch-scoped admin can't create a booking under
-- a different branch than their own.
drop policy if exists "bookings_insert_any" on public.bookings;
create policy "bookings_insert_any"
  on public.bookings for insert
  to anon, authenticated
  with check (
    customer_id is null
    or ((select auth.uid()) is not null and customer_id = (select auth.uid()))
    or public.is_super_admin()
    or (public.is_admin() and branch = public.admin_branch())
  );

-- ── booking_items: inherit the parent booking's branch scoping ──
drop policy if exists "booking_items_select_via_booking" on public.booking_items;
create policy "booking_items_select_via_booking"
  on public.booking_items for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          b.customer_id = auth.uid()
          or public.is_super_admin()
          or (public.is_admin() and b.branch = public.admin_branch())
        )
    )
  );

drop policy if exists "booking_items_insert_via_booking" on public.booking_items;
create policy "booking_items_insert_via_booking"
  on public.booking_items for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          b.customer_id = auth.uid()
          or b.customer_id is null
          or public.is_super_admin()
          or (public.is_admin() and b.branch = public.admin_branch())
        )
    )
  );

drop policy if exists "booking_items_modify_admin" on public.booking_items;
create policy "booking_items_modify_admin"
  on public.booking_items for update
  using (
    public.is_super_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.branch = public.admin_branch())
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.branch = public.admin_branch())
  );

drop policy if exists "booking_items_delete_admin" on public.booking_items;
create policy "booking_items_delete_admin"
  on public.booking_items for delete
  using (
    public.is_super_admin()
    or exists (select 1 from public.bookings b where b.id = booking_id and b.branch = public.admin_branch())
  );

-- ── profiles.branch: assign once, lock thereafter ──────────────
-- REMOVED (2026-07-08): originally a BEFORE UPDATE trigger on profiles that
-- called is_super_admin() (itself a query against profiles) to block
-- reassigning an already-set branch. This hit Postgres's own RLS recursion
-- guard — "infinite recursion detected in policy for relation profiles" —
-- because the trigger re-queries its own table mid-statement while that
-- statement is still resolving profiles' RLS policies, regardless of the
-- function being SECURITY DEFINER. It broke every first-time branch
-- assignment (the admin login flow's `UPDATE profiles SET branch = ...`),
-- i.e. it broke exactly the feature it was meant to protect.
--
-- The "assign once, verify thereafter" rule is now enforced ONLY at the
-- app layer (src/app/admin/login/actions.ts: adminLogin only UPDATEs when
-- profile.branch IS NULL, and rejects login outright on a mismatch). A
-- determined admin with direct REST/API access could theoretically still
-- PATCH their own branch — a real but low-severity gap (self-service admin
-- account tampering, not a customer-data leak) accepted in exchange for a
-- working login flow. Revisit if that trust boundary ever matters more.
