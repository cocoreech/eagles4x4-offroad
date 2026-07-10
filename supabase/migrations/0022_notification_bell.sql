-- 0022 — Revive public.notifications as the in-app notification bell
--
-- notifications existed since 0006 but was completely unused: no INSERT
-- path, no UPDATE policy (can't mark read), no 'in_app' type value, and
-- zero references anywhere in src/. This adds what's missing to make it
-- the backing store for a customer-facing bell (promo publish + booking
-- milestones).

alter type public.notification_type add value if not exists 'in_app';

-- Where tapping a notification should take the customer, e.g.
-- '/events/spring-lift-promo' or '/bookings/EG-2026-0148'.
alter table public.notifications add column link text;

-- Let a customer mark their own notifications read. INSERT stays
-- policy-less (blocked for anon/authenticated) — rows are only ever
-- written by server actions using the service-role client.
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
