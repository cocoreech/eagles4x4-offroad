-- ============================================================
-- Eagles 4x4 Offroad — Initial Schema Migration
-- Created: 2026-05-31
-- ============================================================

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Helper: updated_at auto-touch
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 1. PROFILES
-- ─────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  phone         text,
  email         text,
  role          text not null default 'customer'
                check (role in ('customer','staff','admin','super_admin')),
  avatar_url    text,
  facebook_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile when a new auth.user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is current user admin or higher?
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin','super_admin')
  );
$$;

-- ─────────────────────────────────────────────
-- 2. VEHICLES
-- ─────────────────────────────────────────────
create table public.vehicles (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles on delete cascade,
  make            text not null,
  model           text not null,
  year            smallint,
  transmission    text check (transmission in ('automatic','manual')),
  plate_number    text,
  existing_mods   text,
  created_at      timestamptz not null default now()
);

create index vehicles_owner_idx on public.vehicles(owner_id);

-- ─────────────────────────────────────────────
-- 3. SERVICES (admin-editable catalog)
-- ─────────────────────────────────────────────
create table public.services (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  description     text,
  category        text not null
                  check (category in ('suspension','protection','recovery','lighting','full-builds','accessories')),
  icon            text,
  starting_price  numeric(10,2) not null,
  duration_hours  numeric(4,1),
  image_url       text,
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create index services_category_active_idx on public.services(category, is_active);

-- ─────────────────────────────────────────────
-- 4. PRODUCTS (shop inventory)
-- ─────────────────────────────────────────────
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  brand       text,
  description text,
  category    text not null
              check (category in ('suspension','wheels-tires','recovery','lighting','protection')),
  price       numeric(10,2) not null,
  stock       integer not null default 0,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_category_active_idx on public.products(category, is_active);

-- ─────────────────────────────────────────────
-- 5. BUILDS (portfolio gallery)
-- ─────────────────────────────────────────────
create table public.builds (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  title               text not null,
  vehicle_make        text not null,
  vehicle_model       text not null,
  vehicle_year        smallint,
  location            text,
  description         text,
  build_date          date,
  duration_days       integer,
  is_featured         boolean not null default false,
  cover_image_url     text,
  gallery_image_urls  text[] default '{}',
  tags                text[] default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger builds_updated_at
  before update on public.builds
  for each row execute function public.set_updated_at();

create index builds_featured_date_idx on public.builds(is_featured, build_date desc);

-- ─────────────────────────────────────────────
-- 6. BOOKINGS
-- ─────────────────────────────────────────────
-- Booking code generator: EG-{YYYY}-{NNNN}
create sequence if not exists public.booking_seq start 1;

create or replace function public.generate_booking_code()
returns trigger
language plpgsql
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n  bigint;
begin
  if new.booking_code is null or new.booking_code = '' then
    n := nextval('public.booking_seq');
    new.booking_code := 'EG-' || yr || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  booking_code         text unique,
  customer_id          uuid references public.profiles on delete set null,
  vehicle_id           uuid references public.vehicles on delete set null,
  scheduled_date       date not null,
  scheduled_time       time not null,
  backup_date          date,
  assigned_tech_id     uuid references public.profiles on delete set null,
  service_bay          text,
  status               text not null default 'pending'
                       check (status in ('pending','confirmed','in_progress','parts_installed','quality_check','ready','completed','cancelled')),
  subtotal             numeric(10,2) default 0,
  labor_cost           numeric(10,2) default 0,
  total_amount         numeric(10,2) default 0,
  notes                text,
  contact_phone        text,
  contact_facebook     text,
  contact_email        text,
  estimated_ready_at   timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger bookings_set_code
  before insert on public.bookings
  for each row execute function public.generate_booking_code();

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create index bookings_customer_idx     on public.bookings(customer_id);
create index bookings_scheduled_idx    on public.bookings(scheduled_date);
create index bookings_status_idx       on public.bookings(status);

-- ─────────────────────────────────────────────
-- 7. BOOKING ITEMS
-- ─────────────────────────────────────────────
create table public.booking_items (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings on delete cascade,
  item_type       text not null check (item_type in ('service','product','addon')),
  service_id      uuid references public.services on delete set null,
  product_id      uuid references public.products on delete set null,
  name_snapshot   text not null,
  price_snapshot  numeric(10,2) not null,
  quantity        integer not null default 1,
  created_at      timestamptz not null default now()
);

create index booking_items_booking_idx on public.booking_items(booking_id);

-- ─────────────────────────────────────────────
-- 8. BOOKING STATUS HISTORY (live tracking)
-- ─────────────────────────────────────────────
create table public.booking_status_history (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings on delete cascade,
  status        text not null,
  updated_by    uuid references public.profiles on delete set null,
  title         text not null,
  notes         text,
  photo_urls    text[] default '{}',
  created_at    timestamptz not null default now()
);

create index booking_history_idx on public.booking_status_history(booking_id, created_at desc);

-- Auto-log status changes
create or replace function public.log_booking_status_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.booking_status_history (booking_id, status, title)
    values (new.id, new.status, 'Booking created · ' || new.status);
  elsif (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into public.booking_status_history (booking_id, status, title)
    values (new.id, new.status, 'Status changed to ' || new.status);
  end if;
  return new;
end;
$$;

create trigger bookings_log_status
  after insert or update of status on public.bookings
  for each row execute function public.log_booking_status_change();

-- ─────────────────────────────────────────────
-- 9. QUOTES
-- ─────────────────────────────────────────────
create sequence if not exists public.quote_seq start 1;

create or replace function public.generate_quote_code()
returns trigger
language plpgsql
as $$
declare
  yr text := to_char(now(), 'YYYY');
  n  bigint;
begin
  if new.quote_code is null or new.quote_code = '' then
    n := nextval('public.quote_seq');
    new.quote_code := 'QT-' || yr || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

create table public.quotes (
  id                    uuid primary key default gen_random_uuid(),
  quote_code            text unique,
  customer_id           uuid references public.profiles on delete set null,
  customer_name         text,
  customer_phone        text,
  customer_email        text,
  subtotal              numeric(10,2) default 0,
  labor_estimate        numeric(10,2) default 0,
  total                 numeric(10,2) default 0,
  status                text not null default 'draft'
                        check (status in ('draft','sent','converted','expired')),
  converted_booking_id  uuid references public.bookings on delete set null,
  expires_at            timestamptz default (now() + interval '30 days'),
  created_at            timestamptz not null default now()
);

create trigger quotes_set_code
  before insert on public.quotes
  for each row execute function public.generate_quote_code();

create index quotes_customer_idx on public.quotes(customer_id);
create index quotes_status_idx   on public.quotes(status);

-- ─────────────────────────────────────────────
-- 10. QUOTE ITEMS
-- ─────────────────────────────────────────────
create table public.quote_items (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes on delete cascade,
  item_type       text not null check (item_type in ('service','product')),
  service_id      uuid references public.services on delete set null,
  product_id      uuid references public.products on delete set null,
  name_snapshot   text not null,
  price_snapshot  numeric(10,2) not null,
  quantity        integer not null default 1
);

create index quote_items_quote_idx on public.quote_items(quote_id);

-- ─────────────────────────────────────────────
-- 11. EVENTS
-- ─────────────────────────────────────────────
create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,
  title                text not null,
  description          text,
  event_type           text not null
                       check (event_type in ('trail_run','meet','workshop','brand_event')),
  starts_at            timestamptz not null,
  ends_at              timestamptz,
  location             text,
  difficulty           text check (difficulty in ('beginner','intermediate','advanced','n/a')),
  max_attendees        integer,
  cover_image_url      text,
  gallery_image_urls   text[] default '{}',
  is_featured          boolean not null default false,
  is_published         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create index events_starts_published_idx on public.events(starts_at, is_published);

-- ─────────────────────────────────────────────
-- 12. EVENT RSVPS
-- ─────────────────────────────────────────────
create table public.event_rsvps (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events on delete cascade,
  customer_id uuid not null references public.profiles on delete cascade,
  vehicle_id  uuid references public.vehicles on delete set null,
  status      text not null default 'going'
              check (status in ('going','maybe','cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (event_id, customer_id)
);

create index event_rsvps_event_idx    on public.event_rsvps(event_id);
create index event_rsvps_customer_idx on public.event_rsvps(customer_id);

-- ─────────────────────────────────────────────
-- 13. AVAILABILITY (admin calendar overrides)
-- ─────────────────────────────────────────────
create table public.availability (
  id            uuid primary key default gen_random_uuid(),
  date          date unique not null,
  is_closed     boolean not null default false,
  opens_at      time,
  closes_at     time,
  max_bookings  integer,
  notes         text
);

-- ─────────────────────────────────────────────
-- 14. SITE CONTENT (editable copy)
-- ─────────────────────────────────────────────
create table public.site_content (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  value       jsonb not null,
  updated_by  uuid references public.profiles on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger site_content_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- 15. MEDIA (central image library)
-- ─────────────────────────────────────────────
create table public.media (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,
  public_url    text not null,
  file_name     text,
  mime_type     text,
  size_bytes    integer,
  width         integer,
  height        integer,
  alt_text      text,
  uploaded_by   uuid references public.profiles on delete set null,
  tags          text[] default '{}',
  created_at    timestamptz not null default now()
);

create index media_uploaded_idx on public.media(uploaded_by);
