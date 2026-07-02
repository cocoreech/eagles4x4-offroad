-- 0016 — Preferred greeting name ("what should we call you?").
-- contact_name stays as the full name; preferred_name is the greeting.
alter table public.bookings  add column if not exists preferred_name text;
alter table public.profiles  add column if not exists preferred_name text;
