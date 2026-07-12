-- 0032 — Add PMS (Preventive Maintenance Service) as a trackable service.
-- PMS reminders now only trigger if the last completed booking included a PMS service.

insert into public.services (slug, name, description, category, icon, starting_price, duration_hours, display_order, is_active)
values
  ('pms-maintenance', 'Preventive Maintenance', 'Regular maintenance check-up — fluids, filters, belts, battery. Keep your vehicle trail-ready.', 'accessories', '🔧', 3000, 1.5, 5, true)
on conflict (slug) do nothing;
