-- 0015 — Touchpoints can be delivered into the customer inbox (Phase 3).
-- Account-holders get reminders/follow-ups as an in-app bot message they can
-- reply to; guests keep the email / manual-chat paths.
alter type public.touchpoint_channel add value if not exists 'inbox';
