-- 0027 — Post-service feedback: next-day follow-up asking how the service/install went.
--
-- Sent to account-holder customers 1 day after a booking is marked 'completed'.
-- Rating is a fixed reaction (thumbs down / thumbs up / heart) plus three
-- fixed 1-5 questions, and an optional free-text field. Free text is
-- moderated: admin approves or rejects before it can appear on the public
-- testimonials page.

create table public.booking_feedback (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings on delete cascade,
  customer_id           uuid not null references public.profiles on delete cascade,
  reaction              text not null check (reaction in ('thumbs_down','thumbs_up','heart')),
  service_quality       smallint not null check (service_quality between 1 and 5),
  install_quality       smallint not null check (install_quality between 1 and 5),
  would_recommend       smallint not null check (would_recommend between 1 and 5),
  comment               text,
  moderation_status     text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  published             boolean not null default false,
  reminder_sent_at      timestamptz,
  created_at            timestamptz not null default now(),
  unique (booking_id)
);

create index booking_feedback_customer_idx on public.booking_feedback (customer_id);
create index booking_feedback_moderation_idx on public.booking_feedback (moderation_status);
create index booking_feedback_published_idx on public.booking_feedback (published) where published;

-- Tracks which completed bookings already got the next-day follow-up, so the
-- daily cron doesn't resend if it reruns same-day.
alter table public.bookings
  add column if not exists feedback_requested_at timestamptz;

alter table public.booking_feedback enable row level security;

-- Customer can submit/view their own feedback; admin can see and moderate all.
create policy "booking_feedback_owner_select" on public.booking_feedback
  for select using (customer_id = auth.uid() or public.is_admin());

create policy "booking_feedback_owner_insert" on public.booking_feedback
  for insert with check (customer_id = auth.uid());

create policy "booking_feedback_admin_update" on public.booking_feedback
  for update using (public.is_admin());

-- Public testimonials page: anyone (including anon) can read published+approved feedback.
create policy "booking_feedback_public_select" on public.booking_feedback
  for select using (published = true and moderation_status = 'approved');
