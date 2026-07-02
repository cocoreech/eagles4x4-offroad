-- 0017 — Editable availability: weekly hours + global settings.
create table if not exists public.shop_hours (
  weekday          int primary key check (weekday between 0 and 6),
  is_open          boolean not null,
  open_hour        int not null default 8,
  close_hour       int not null default 18,
  lunch_start_hour int,
  lunch_end_hour   int
);
create table if not exists public.shop_settings (
  id                    int primary key default 1 check (id = 1),
  slot_capacity         int not null default 3,
  booking_window_months int not null default 6
);

alter table public.shop_hours    enable row level security;
alter table public.shop_settings enable row level security;
create policy "shop_hours_read"  on public.shop_hours    for select using (true);
create policy "shop_hours_admin" on public.shop_hours    for all using (public.is_admin()) with check (public.is_admin());
create policy "shop_settings_read"  on public.shop_settings for select using (true);
create policy "shop_settings_admin" on public.shop_settings for all using (public.is_admin()) with check (public.is_admin());

-- Seed today's exact behavior: Sun closed; Mon–Fri 8–18 lunch 12–13; Sat 8–17 lunch 12–13.
insert into public.shop_hours (weekday, is_open, open_hour, close_hour, lunch_start_hour, lunch_end_hour) values
  (0, false, 8, 18, 12, 13),
  (1, true,  8, 18, 12, 13),
  (2, true,  8, 18, 12, 13),
  (3, true,  8, 18, 12, 13),
  (4, true,  8, 18, 12, 13),
  (5, true,  8, 18, 12, 13),
  (6, true,  8, 17, 12, 13)
on conflict (weekday) do nothing;

insert into public.shop_settings (id, slot_capacity, booking_window_months)
  values (1, 3, 6) on conflict (id) do nothing;
