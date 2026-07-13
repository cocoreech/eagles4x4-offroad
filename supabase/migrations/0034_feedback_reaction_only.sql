-- 0034 — Simplify feedback to reaction-only (thumbs down / thumbs up / heart).
-- Drops the three 1-5 star rating questions — customers just tap one reaction.

alter table public.booking_feedback
  drop column service_quality,
  drop column install_quality,
  drop column would_recommend;
