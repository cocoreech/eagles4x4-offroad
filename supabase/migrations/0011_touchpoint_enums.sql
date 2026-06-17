-- 0011 — Touchpoint enums (isolated so new values are usable in 0012)

-- Generalize the follow-up enum into the Touchpoint concept.
alter type public.follow_up_type rename to touchpoint_type;
alter type public.touchpoint_type add value if not exists 'appointment_reminder';
-- seasonal / trail_ready remain reserved (unused) for a future broadcast feature.

-- Delivery channel. Phase 2 adds 'sms','whatsapp'.
do $$ begin
  create type public.touchpoint_channel as enum ('email','chat');
exception when duplicate_object then null; end $$;
