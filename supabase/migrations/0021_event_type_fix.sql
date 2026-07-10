-- 0021 — Fix events.event_type constraint drift
--
-- The original constraint (0001_initial_schema.sql) only allowed
-- ('trail_run','meet','workshop','brand_event'), but the admin UI
-- (EventForm.tsx, admin/events/actions.ts) has always submitted
-- ('trail_ride','product_launch','promo','meetup','workshop'). Only
-- 'workshop' overlapped — every other event type, including 'promo',
-- has been rejected by the database since day one.

alter table public.events drop constraint events_event_type_check;

alter table public.events add constraint events_event_type_check
  check (event_type in ('trail_ride','product_launch','promo','meetup','workshop'));
