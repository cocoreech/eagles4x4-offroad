-- ============================================================
-- 0006 — Security hardening + audit logs + storage + notifications
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. AUDIT_LOGS
-- ─────────────────────────────────────────────
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete set null,
  action_type  text not null check (action_type in ('INSERT','UPDATE','DELETE')),
  table_name   text not null,
  record_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

create index audit_logs_table_record_idx on public.audit_logs(table_name, record_id);
create index audit_logs_user_idx          on public.audit_logs(user_id);
create index audit_logs_created_idx       on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_admin_select"
  on public.audit_logs for select
  using (public.is_admin());

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_record_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    v_record_id := old.id;
  elsif (tg_op = 'INSERT') then
    v_new := to_jsonb(new);
    v_record_id := new.id;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_record_id := new.id;
  end if;

  insert into public.audit_logs (user_id, action_type, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_name, v_record_id, v_old, v_new);

  return coalesce(new, old);
end;
$$;

revoke execute on function public.log_audit_event() from anon, authenticated, public;

create trigger bookings_audit_trigger
  after insert or update or delete on public.bookings
  for each row execute function public.log_audit_event();

create trigger quotes_audit_trigger
  after insert or update or delete on public.quotes
  for each row execute function public.log_audit_event();

create trigger profiles_audit_trigger
  after insert or update or delete on public.profiles
  for each row execute function public.log_audit_event();

create trigger booking_status_history_audit_trigger
  after insert or update or delete on public.booking_status_history
  for each row execute function public.log_audit_event();

-- ─────────────────────────────────────────────
-- 2-4. REWRITE POLICIES: (select auth.uid()) + WITH CHECK + role lock
-- ─────────────────────────────────────────────

-- PROFILES
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_self"          on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_insert_self"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "profiles_update_self_no_role_change"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check (
    (select auth.uid()) = id
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- VEHICLES
drop policy if exists "vehicles_select_own_or_admin" on public.vehicles;
drop policy if exists "vehicles_insert_own"           on public.vehicles;
drop policy if exists "vehicles_update_own_or_admin"  on public.vehicles;
drop policy if exists "vehicles_delete_own_or_admin"  on public.vehicles;

create policy "vehicles_select_own_or_admin"
  on public.vehicles for select
  using (owner_id = (select auth.uid()) or public.is_admin());

create policy "vehicles_insert_own"
  on public.vehicles for insert
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy "vehicles_update_own_or_admin"
  on public.vehicles for update
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy "vehicles_delete_own_or_admin"
  on public.vehicles for delete
  using (owner_id = (select auth.uid()) or public.is_admin());

-- BOOKINGS
drop policy if exists "bookings_select_own_or_admin"      on public.bookings;
drop policy if exists "bookings_insert_any_authenticated" on public.bookings;
drop policy if exists "bookings_update_admin"             on public.bookings;
drop policy if exists "bookings_delete_admin"             on public.bookings;

create policy "bookings_select_own_or_admin"
  on public.bookings for select
  using (customer_id = (select auth.uid()) or public.is_admin());

create policy "bookings_insert_any_authenticated"
  on public.bookings for insert
  with check (customer_id = (select auth.uid()) or customer_id is null or public.is_admin());

create policy "bookings_update_admin"
  on public.bookings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "bookings_delete_admin"
  on public.bookings for delete
  using (public.is_admin());

-- BOOKING_ITEMS
drop policy if exists "booking_items_select_via_booking" on public.booking_items;
drop policy if exists "booking_items_insert_via_booking" on public.booking_items;
drop policy if exists "booking_items_modify_admin"       on public.booking_items;
drop policy if exists "booking_items_delete_admin"       on public.booking_items;

create policy "booking_items_select_via_booking"
  on public.booking_items for select
  using (exists (select 1 from public.bookings b where b.id = booking_id
    and (b.customer_id = (select auth.uid()) or public.is_admin())));

create policy "booking_items_insert_via_booking"
  on public.booking_items for insert
  with check (exists (select 1 from public.bookings b where b.id = booking_id
    and (b.customer_id = (select auth.uid()) or b.customer_id is null or public.is_admin())));

create policy "booking_items_modify_admin"
  on public.booking_items for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "booking_items_delete_admin"
  on public.booking_items for delete
  using (public.is_admin());

-- BOOKING_STATUS_HISTORY
drop policy if exists "history_select_via_booking" on public.booking_status_history;
drop policy if exists "history_admin_write"        on public.booking_status_history;

create policy "history_select_via_booking"
  on public.booking_status_history for select
  using (exists (select 1 from public.bookings b where b.id = booking_id
    and (b.customer_id = (select auth.uid()) or public.is_admin())));

create policy "history_admin_write"
  on public.booking_status_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- QUOTES
drop policy if exists "quotes_select_own_or_admin" on public.quotes;
drop policy if exists "quotes_insert_any"          on public.quotes;
drop policy if exists "quotes_update_admin"        on public.quotes;
drop policy if exists "quotes_delete_admin"        on public.quotes;

create policy "quotes_select_own_or_admin"
  on public.quotes for select
  using (customer_id = (select auth.uid()) or public.is_admin());

create policy "quotes_insert_any"
  on public.quotes for insert
  with check (customer_id = (select auth.uid()) or customer_id is null or public.is_admin());

create policy "quotes_update_admin"
  on public.quotes for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "quotes_delete_admin"
  on public.quotes for delete
  using (public.is_admin());

-- QUOTE_ITEMS
drop policy if exists "quote_items_select_via_quote" on public.quote_items;
drop policy if exists "quote_items_insert_via_quote" on public.quote_items;
drop policy if exists "quote_items_modify_admin"     on public.quote_items;
drop policy if exists "quote_items_delete_admin"     on public.quote_items;

create policy "quote_items_select_via_quote"
  on public.quote_items for select
  using (exists (select 1 from public.quotes q where q.id = quote_id
    and (q.customer_id = (select auth.uid()) or public.is_admin())));

create policy "quote_items_insert_via_quote"
  on public.quote_items for insert
  with check (exists (select 1 from public.quotes q where q.id = quote_id
    and (q.customer_id = (select auth.uid()) or q.customer_id is null or public.is_admin())));

create policy "quote_items_modify_admin"
  on public.quote_items for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "quote_items_delete_admin"
  on public.quote_items for delete
  using (public.is_admin());

-- EVENT_RSVPS
drop policy if exists "rsvps_select_own_or_admin" on public.event_rsvps;
drop policy if exists "rsvps_insert_self"         on public.event_rsvps;
drop policy if exists "rsvps_update_own_or_admin" on public.event_rsvps;
drop policy if exists "rsvps_delete_own_or_admin" on public.event_rsvps;

create policy "rsvps_select_own_or_admin"
  on public.event_rsvps for select
  using (customer_id = (select auth.uid()) or public.is_admin());

create policy "rsvps_insert_self"
  on public.event_rsvps for insert
  with check (customer_id = (select auth.uid()) or public.is_admin());

create policy "rsvps_update_own_or_admin"
  on public.event_rsvps for update
  using (customer_id = (select auth.uid()) or public.is_admin())
  with check (customer_id = (select auth.uid()) or public.is_admin());

create policy "rsvps_delete_own_or_admin"
  on public.event_rsvps for delete
  using (customer_id = (select auth.uid()) or public.is_admin());

-- MEDIA table (not storage.objects)
drop policy if exists "media_authenticated_insert" on public.media;
drop policy if exists "media_admin_delete"          on public.media;

create policy "media_authenticated_insert"
  on public.media for insert
  with check ((select auth.uid()) is not null);

create policy "media_admin_delete"
  on public.media for delete
  using (public.is_admin() or uploaded_by = (select auth.uid()));

-- ─────────────────────────────────────────────
-- 5. ENABLE RLS ON EVERY TABLE
-- ─────────────────────────────────────────────
alter table public.profiles                enable row level security;
alter table public.vehicles                enable row level security;
alter table public.services                enable row level security;
alter table public.products                enable row level security;
alter table public.builds                  enable row level security;
alter table public.bookings                enable row level security;
alter table public.booking_items           enable row level security;
alter table public.booking_status_history  enable row level security;
alter table public.quotes                  enable row level security;
alter table public.quote_items             enable row level security;
alter table public.events                  enable row level security;
alter table public.event_rsvps             enable row level security;
alter table public.availability            enable row level security;
alter table public.site_content            enable row level security;
alter table public.media                   enable row level security;
alter table public.audit_logs              enable row level security;

-- ─────────────────────────────────────────────
-- 6. STORAGE BUCKETS — builds + media (PRIVATE, set in dashboard)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('builds', 'builds', false, 10485760, array['image/jpeg','image/jpg','image/png','image/webp']),
  ('media',  'media',  false, 10485760, array['image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "builds_bucket_public_read"            on storage.objects;
drop policy if exists "builds_bucket_authenticated_insert"   on storage.objects;
drop policy if exists "builds_bucket_uploader_admin_update"  on storage.objects;
drop policy if exists "builds_bucket_uploader_admin_delete"  on storage.objects;
drop policy if exists "media_bucket_public_read"             on storage.objects;
drop policy if exists "media_bucket_authenticated_insert"    on storage.objects;
drop policy if exists "media_bucket_uploader_admin_update"   on storage.objects;
drop policy if exists "media_bucket_uploader_admin_delete"   on storage.objects;

-- builds bucket
create policy "builds_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'builds');

create policy "builds_bucket_authenticated_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'builds'
    and (select auth.uid()) is not null
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
    and coalesce((metadata->>'size')::bigint, 0) <= 10485760
  );

create policy "builds_bucket_uploader_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'builds'
    and (owner = (select auth.uid()) or public.is_admin())
  );

create policy "builds_bucket_uploader_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'builds'
    and (owner = (select auth.uid()) or public.is_admin())
  );

-- media bucket
create policy "media_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media_bucket_authenticated_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and (select auth.uid()) is not null
    and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
    and coalesce((metadata->>'size')::bigint, 0) <= 10485760
  );

create policy "media_bucket_uploader_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'media'
    and (owner = (select auth.uid()) or public.is_admin())
  );

create policy "media_bucket_uploader_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and (owner = (select auth.uid()) or public.is_admin())
  );

-- NOTE: In the Supabase dashboard, ensure both 'builds' and 'media' buckets
-- are set to PRIVATE. The policies above gate access.

-- ─────────────────────────────────────────────
-- 7. NOTIFICATIONS + FOLLOW_UP_LOGS
-- ─────────────────────────────────────────────

-- Enums
do $$ begin
  create type public.notification_type as enum ('push','sms','email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.follow_up_type as enum ('post_service','pms_reminder','seasonal','trail_ready');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.follow_up_status as enum ('pending','sent','replied','no_response');
exception when duplicate_object then null; end $$;

-- notifications
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  type        public.notification_type not null,
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx   on public.notifications(user_id);
create index notifications_unread_idx on public.notifications(user_id, is_read) where is_read = false;

alter table public.notifications enable row level security;

create policy "notifications_select_own_or_admin"
  on public.notifications for select
  using (user_id = (select auth.uid()) or public.is_admin());

-- INSERT only via SECURITY DEFINER functions (no policy = blocked for anon/authenticated)
-- UPDATE/DELETE blocked by absence of policy

-- follow_up_logs
create table public.follow_up_logs (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid references public.bookings on delete set null,
  vehicle_id          uuid references public.vehicles on delete set null,
  customer_id         uuid not null references public.profiles on delete cascade,
  follow_up_type      public.follow_up_type not null,
  message_sent        text,
  response_received   text,
  status              public.follow_up_status not null default 'pending',
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index follow_up_customer_idx on public.follow_up_logs(customer_id);
create index follow_up_booking_idx  on public.follow_up_logs(booking_id);
create index follow_up_status_idx   on public.follow_up_logs(status, scheduled_at);

alter table public.follow_up_logs enable row level security;

create policy "follow_up_select_own_or_admin"
  on public.follow_up_logs for select
  using (customer_id = (select auth.uid()) or public.is_admin());

create policy "follow_up_admin_write"
  on public.follow_up_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────
-- RLS VERIFICATION QUERY (run manually after migration)
-- ─────────────────────────────────────────────
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;
