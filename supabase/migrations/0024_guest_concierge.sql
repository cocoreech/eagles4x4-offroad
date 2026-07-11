-- 0024 — Guest Concierge: anonymous chat + Lead capture
--
-- Extends the AI Concierge to anonymous homepage/site-wide guests (see
-- docs/adr/0004). Kept fully separate from conversations/conversation_messages
-- (which are FK'd not-null to profiles and wired into the admin bell/review UI
-- and Realtime) — a guest session has none of that. All access to these three
-- tables is via the service-role client from server actions, same pattern
-- already used for guest bookings; no anon-role policies exist here.

create table public.guest_conversations (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null unique,
  ip               text,
  status           text not null default 'open' check (status in ('open','awaiting_merchant','closed')),
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

create table public.guest_messages (
  id                     uuid primary key default gen_random_uuid(),
  guest_conversation_id  uuid not null references public.guest_conversations on delete cascade,
  sender                 text not null check (sender in ('guest','bot')),
  body                   text not null,
  created_at             timestamptz not null default now()
);
create index guest_messages_conversation_created_idx on public.guest_messages (guest_conversation_id, created_at);

-- Contact info captured on chat escalation. No login capability — deliberately
-- NOT a profiles row (see CONTEXT.md Lead definition). Distinct from the
-- query-based "lead" concept used for catalog-announcement emails
-- (src/lib/notifications/leads.ts, sourced from guest bookings) — this table
-- is specifically for chat-captured contacts so conversion can be tracked.
create table public.leads (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  email                   text not null,
  phone                   text,
  source                  text not null default 'guest_chat',
  guest_conversation_id   uuid references public.guest_conversations on delete set null,
  converted               boolean not null default false,
  converted_customer_id   uuid references public.profiles on delete set null,
  created_at              timestamptz not null default now()
);

alter table public.guest_conversations enable row level security;
alter table public.guest_messages enable row level security;
alter table public.leads enable row level security;

create policy "guest_conversations_admin_select" on public.guest_conversations for select using (public.is_admin());
create policy "guest_messages_admin_select" on public.guest_messages for select using (public.is_admin());
create policy "leads_admin_select" on public.leads for select using (public.is_admin());
