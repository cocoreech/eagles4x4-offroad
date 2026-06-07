-- ============================================================
-- 0009 — PayMongo deposit payments
-- ============================================================
-- Adds payment state to bookings + a payments audit log table.
-- Design choice: payment_status is orthogonal to booking.status pipeline
--   - booking.status:       pending → confirmed → in_progress → ... → completed
--   - booking.payment_status: unpaid → paid → refunded
-- This means admins still see the familiar booking pipeline;
-- payment is a separate dimension visible as a badge.

-- ── New columns on bookings ──────────────────────────────────
alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded','failed')),
  add column if not exists payment_amount numeric(10,2) default 0,
  add column if not exists payment_intent_id text,
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz;

create index if not exists bookings_payment_status_idx on public.bookings(payment_status);
create index if not exists bookings_payment_intent_idx on public.bookings(payment_intent_id);

-- ── Payments audit log ──────────────────────────────────────
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings on delete cascade,
  provider        text not null default 'paymongo',
  provider_intent_id text,
  provider_session_id text,
  amount          numeric(10,2) not null,
  currency        text not null default 'PHP',
  status          text not null
                  check (status in ('initiated','succeeded','failed','refunded','cancelled')),
  method          text,
  raw_event       jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists payments_booking_idx on public.payments(booking_id);
create index if not exists payments_intent_idx  on public.payments(provider_intent_id);
create index if not exists payments_status_idx  on public.payments(status, created_at desc);

alter table public.payments enable row level security;

-- updated_at trigger
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ── Audit log trigger ───────────────────────────────────────
create trigger payments_audit_trigger after insert or update or delete on public.payments
  for each row execute function public.log_audit_event();

-- ── RLS policies ───────────────────────────────────────────
-- Customer can see their own payments (via booking ownership)
create policy "payments_select_own_or_admin"
  on public.payments for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (b.customer_id = (select auth.uid()) or public.is_admin())
    )
  );

-- Inserts only happen server-side via service-role (webhook handler).
-- Updates/deletes admin only.
create policy "payments_admin_write"
  on public.payments for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "payments_admin_delete"
  on public.payments for delete
  to authenticated
  using (public.is_admin());

-- ── Grants ──────────────────────────────────────────────────
grant select on public.payments to authenticated;
grant insert, update, delete on public.payments to authenticated;
