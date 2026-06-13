-- ============================================================
-- 0010 — Guest checkout support
-- ============================================================
-- Guests book without an account. They have no profile, so they cannot
-- own a row in `vehicles` (vehicles.owner_id is NOT NULL → profiles).
--
-- We therefore snapshot the guest's vehicle details directly onto the
-- booking, mirroring the existing snapshot pattern used by
-- booking_items (price_snapshot / name_snapshot). These columns are
-- populated only for guest bookings (customer_id IS NULL); authenticated
-- bookings continue to reference a real vehicle via vehicle_id.
--
-- RLS already permits anonymous inserts (see 0002: the bookings and
-- booking_items insert policies both allow `customer_id is null`), so no
-- policy changes are needed. Guest reads are served server-side via the
-- service-role client, since the SELECT policy is owner/admin-only.

alter table public.bookings
  add column if not exists vehicle_make_snapshot         text,
  add column if not exists vehicle_model_snapshot        text,
  add column if not exists vehicle_year_snapshot         smallint,
  add column if not exists vehicle_transmission_snapshot text
    check (vehicle_transmission_snapshot in ('automatic','manual'));

comment on column public.bookings.vehicle_make_snapshot is
  'Guest vehicle make. Set only when customer_id IS NULL (no owned vehicle row).';
comment on column public.bookings.vehicle_model_snapshot is
  'Guest vehicle model. Set only when customer_id IS NULL.';
comment on column public.bookings.vehicle_year_snapshot is
  'Guest vehicle year. Set only when customer_id IS NULL.';
comment on column public.bookings.vehicle_transmission_snapshot is
  'Guest vehicle transmission. Set only when customer_id IS NULL.';
