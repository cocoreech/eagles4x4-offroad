-- 0028 — Allow 'needs_reschedule' as a booking status.
-- Set by the Monday-morning slot verification (verify-and-confirm) when a
-- guest's slot filled before an admin could confirm it, so it doesn't get
-- silently confused with an ordinary 'pending' booking.

alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending','confirmed','in_progress','parts_installed','quality_check','ready','completed','cancelled','needs_reschedule'));

-- Drop the now-redundant dedupe column from 0027: the post-service feedback
-- request moved into the touchpoints engine, which already dedupes via the
-- unique (booking_id, type) constraint on public.touchpoints.
alter table public.bookings drop column if exists feedback_requested_at;
