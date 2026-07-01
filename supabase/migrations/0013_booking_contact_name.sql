-- 0013 — Capture the booker's name on the booking
--
-- Guests have no profile (customer_id IS NULL), so there was no name to greet
-- them by. Touchpoint messages open with "Hi {{customer_name}}!", so we capture
-- a name directly on the booking. Authenticated bookings still prefer the
-- linked profile's full_name; this column is the source for guests and a
-- fallback otherwise.

alter table public.bookings
  add column if not exists contact_name text;

comment on column public.bookings.contact_name is
  'Name the booker entered. Primary greeting source for guest bookings (customer_id IS NULL); profiles.full_name takes precedence when a profile is linked.';
