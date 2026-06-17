-- 0012 — Touchpoints table (from follow_up_logs) + templates + opt-outs

-- 1. Generalize follow_up_logs -> touchpoints
alter table public.follow_up_logs rename to touchpoints;
alter table public.touchpoints rename column follow_up_type to type;
alter table public.touchpoints alter column customer_id drop not null;   -- guests have none

alter table public.touchpoints
  add column if not exists channel public.touchpoint_channel not null default 'chat',
  add column if not exists subject text,
  add column if not exists sent_by uuid references public.profiles on delete set null;

-- Idempotency: one touchpoint per (booking, type)
alter table public.touchpoints
  add constraint touchpoints_booking_type_key unique (booking_id, type);

-- 2. Editable templates (one per type x channel)
create table public.touchpoint_templates (
  id          uuid primary key default gen_random_uuid(),
  type        public.touchpoint_type not null,
  channel     public.touchpoint_channel not null,
  subject     text,
  body        text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles on delete set null,
  unique (type, channel)
);
alter table public.touchpoint_templates enable row level security;
create policy "tpl_select_admin" on public.touchpoint_templates
  for select using (public.is_admin());
create policy "tpl_write_admin" on public.touchpoint_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- 3. Email suppression list (keyed by email; works for guests)
create table public.email_opt_outs (
  email      text primary key,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.email_opt_outs enable row level security;
create policy "optout_select_admin" on public.email_opt_outs
  for select using (public.is_admin());
-- INSERT only via service-role unsubscribe endpoint (no policy = blocked otherwise)

-- 4. Seed the 6 default templates (3 types x email/chat). Realistic copy.
insert into public.touchpoint_templates (type, channel, subject, body) values
 ('appointment_reminder','email',
  'Reminder: your Eagles 4x4 booking {{booking_code}} is tomorrow',
  'Hi {{customer_name}}! Just a reminder that your booking ({{booking_code}}) for {{service}} on your {{vehicle}} is tomorrow, {{date}} at {{time}}. See you at {{shop_name}}! Reply here if you need to reschedule.'),
 ('appointment_reminder','chat', null,
  'Hi {{customer_name}}! Reminder: your {{shop_name}} booking {{booking_code}} for {{service}} is tomorrow, {{date}} at {{time}}. See you!'),
 ('post_service','email',
  'How is your {{vehicle}} running?',
  'Hi {{customer_name}}! Thanks for trusting {{shop_name}} with your {{vehicle}} ({{booking_code}}). How is everything running? We would love a quick review — and if you post a build photo, tag us!'),
 ('post_service','chat', null,
  'Hi {{customer_name}}! How is your {{vehicle}} running after the {{service}}? Salamat for choosing {{shop_name}}! A quick review would mean a lot.'),
 ('pms_reminder','email',
  'Time for your {{vehicle}} check-up',
  'Hi {{customer_name}}! It has been about 3 months since we serviced your {{vehicle}} at {{shop_name}}. Offroad use is hard on a rig — book your next check-up to keep it trail-ready.'),
 ('pms_reminder','chat', null,
  'Hi {{customer_name}}! Its been ~3 months since your {{vehicle}} service at {{shop_name}}. Time for a check-up to stay trail-ready? Book anytime!')
on conflict (type, channel) do nothing;
