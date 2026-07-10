-- 0021 — fix events.event_type constraint drift
--
-- The live check constraint was missing 'promo' as an allowed event_type,
-- silently blocking any attempt to post a promo event. Realign it with the
-- full set the app actually uses.

alter table public.events drop constraint events_event_type_check;
alter table public.events add constraint events_event_type_check
  check (event_type in ('trail_ride','product_launch','promo','meetup','workshop'));
