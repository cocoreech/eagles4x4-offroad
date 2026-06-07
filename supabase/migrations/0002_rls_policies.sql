-- ============================================================
-- Eagles 4x4 Offroad — Row Level Security policies
-- Migration 0002
-- ============================================================

-- ─────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────
alter table public.profiles                enable row level security;
alter table public.vehicles                enable row level security;
alter table public.services                enable row level security;
alter table public.products                enable row level security;
alter table public.builds                  enable row level security;
alter table public.bookings                enable row level security;
alter table public.booking_items           enable row level security;
alter table public.booking_status_history  enable row level security;
alter table public.quotes                  enable row level security;
alter table public.quote_items             enable row level security;
alter table public.events                  enable row level security;
alter table public.event_rsvps             enable row level security;
alter table public.availability            enable row level security;
alter table public.site_content            enable row level security;
alter table public.media                   enable row level security;

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────
-- VEHICLES — owners and admins
-- ─────────────────────────────────────────────
create policy "vehicles_select_own_or_admin"
  on public.vehicles for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "vehicles_insert_own"
  on public.vehicles for insert
  with check (owner_id = auth.uid() or public.is_admin());

create policy "vehicles_update_own_or_admin"
  on public.vehicles for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "vehicles_delete_own_or_admin"
  on public.vehicles for delete
  using (owner_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────
-- SERVICES — public read (active), admin write
-- ─────────────────────────────────────────────
create policy "services_public_read_active"
  on public.services for select
  using (is_active = true or public.is_admin());

create policy "services_admin_write"
  on public.services for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- PRODUCTS — public read (active), admin write
-- ─────────────────────────────────────────────
create policy "products_public_read_active"
  on public.products for select
  using (is_active = true or public.is_admin());

create policy "products_admin_write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- BUILDS — public read all, admin write
-- ─────────────────────────────────────────────
create policy "builds_public_read"
  on public.builds for select
  using (true);

create policy "builds_admin_write"
  on public.builds for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- BOOKINGS — customer sees own, admin all
-- ─────────────────────────────────────────────
create policy "bookings_select_own_or_admin"
  on public.bookings for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "bookings_insert_any_authenticated"
  on public.bookings for insert
  with check (
    -- customer can book for themselves, or anonymous bookings (no auth)
    customer_id = auth.uid() or customer_id is null or public.is_admin()
  );

create policy "bookings_update_admin"
  on public.bookings for update
  using (public.is_admin());

create policy "bookings_delete_admin"
  on public.bookings for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- BOOKING_ITEMS — same visibility as parent booking
-- ─────────────────────────────────────────────
create policy "booking_items_select_via_booking"
  on public.booking_items for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "booking_items_insert_via_booking"
  on public.booking_items for insert
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or b.customer_id is null or public.is_admin())
    )
  );

create policy "booking_items_modify_admin"
  on public.booking_items for update
  using (public.is_admin());

create policy "booking_items_delete_admin"
  on public.booking_items for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- BOOKING_STATUS_HISTORY — read with booking, admin write
-- ─────────────────────────────────────────────
create policy "history_select_via_booking"
  on public.booking_status_history for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "history_admin_write"
  on public.booking_status_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- QUOTES — customer sees own, anonymous quotes accessible to all (read-only by code)
-- ─────────────────────────────────────────────
create policy "quotes_select_own_or_admin"
  on public.quotes for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "quotes_insert_any"
  on public.quotes for insert
  with check (
    customer_id = auth.uid() or customer_id is null or public.is_admin()
  );

create policy "quotes_update_admin"
  on public.quotes for update
  using (public.is_admin());

create policy "quotes_delete_admin"
  on public.quotes for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- QUOTE_ITEMS — same as quote
-- ─────────────────────────────────────────────
create policy "quote_items_select_via_quote"
  on public.quote_items for select
  using (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.customer_id = auth.uid() or public.is_admin())
    )
  );

create policy "quote_items_insert_via_quote"
  on public.quote_items for insert
  with check (
    exists (
      select 1 from public.quotes q
      where q.id = quote_id
        and (q.customer_id = auth.uid() or q.customer_id is null or public.is_admin())
    )
  );

create policy "quote_items_modify_admin"
  on public.quote_items for update
  using (public.is_admin());

create policy "quote_items_delete_admin"
  on public.quote_items for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- EVENTS — public read (published), admin write
-- ─────────────────────────────────────────────
create policy "events_public_read_published"
  on public.events for select
  using (is_published = true or public.is_admin());

create policy "events_admin_write"
  on public.events for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- EVENT_RSVPS — customer sees own, admin all
-- ─────────────────────────────────────────────
create policy "rsvps_select_own_or_admin"
  on public.event_rsvps for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "rsvps_insert_self"
  on public.event_rsvps for insert
  with check (customer_id = auth.uid() or public.is_admin());

create policy "rsvps_update_own_or_admin"
  on public.event_rsvps for update
  using (customer_id = auth.uid() or public.is_admin());

create policy "rsvps_delete_own_or_admin"
  on public.event_rsvps for delete
  using (customer_id = auth.uid() or public.is_admin());

-- ─────────────────────────────────────────────
-- AVAILABILITY — public read, admin write
-- ─────────────────────────────────────────────
create policy "availability_public_read"
  on public.availability for select
  using (true);

create policy "availability_admin_write"
  on public.availability for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- SITE_CONTENT — public read, admin write
-- ─────────────────────────────────────────────
create policy "site_content_public_read"
  on public.site_content for select
  using (true);

create policy "site_content_admin_write"
  on public.site_content for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- MEDIA — public read, authenticated upload, admin all
-- ─────────────────────────────────────────────
create policy "media_public_read"
  on public.media for select
  using (true);

create policy "media_authenticated_insert"
  on public.media for insert
  with check (auth.uid() is not null);

create policy "media_admin_modify"
  on public.media for update
  using (public.is_admin());

create policy "media_admin_delete"
  on public.media for delete
  using (public.is_admin() or uploaded_by = auth.uid());
