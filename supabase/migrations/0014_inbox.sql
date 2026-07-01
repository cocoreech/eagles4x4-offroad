-- 0014 — Customer inbox: conversations, messages, merchant presence
-- One conversation per customer; messages stream via Supabase Realtime.

-- 1. Enums
do $$ begin
  create type public.conversation_status as enum ('open','awaiting_merchant','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_sender as enum ('customer','bot','merchant');
exception when duplicate_object then null; end $$;

-- 2. Conversations (one per customer)
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles on delete cascade,
  status          public.conversation_status not null default 'open',
  last_message_at timestamptz,
  doorbell_sent_at timestamptz,            -- debounce for the email nudge
  created_at      timestamptz not null default now(),
  unique (customer_id)
);

-- 3. Messages
create table public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender          public.message_sender not null,
  body            text not null,
  booking_id      uuid references public.bookings on delete set null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index conversation_messages_conv_idx
  on public.conversation_messages (conversation_id, created_at);

-- 4. Merchant presence (drives bot-vs-human in Phase 2; UI indicator now)
create table public.merchant_presence (
  merchant_id uuid primary key references public.profiles on delete cascade,
  online      boolean not null default false,
  last_seen   timestamptz not null default now()
);

-- 5. RLS
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.merchant_presence enable row level security;

-- Customers see/own only their conversation; admins see all.
create policy "conv_select_own" on public.conversations
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "conv_insert_own" on public.conversations
  for insert with check (customer_id = auth.uid() or public.is_admin());
create policy "conv_update_admin_or_own" on public.conversations
  for update using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- Messages: readable/insertable by the conversation's owner or an admin.
-- A customer may only insert sender='customer'; merchant/bot rows come via service role.
create policy "msg_select_member" on public.conversation_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );
create policy "msg_insert_customer" on public.conversation_messages
  for insert with check (
    sender = 'customer' and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );
create policy "msg_insert_admin" on public.conversation_messages
  for insert with check (public.is_admin());
create policy "msg_update_member" on public.conversation_messages
  for update using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );

-- Presence: admin read/write; any authenticated user may read (to show "online").
create policy "presence_select_all_auth" on public.merchant_presence
  for select using (auth.uid() is not null);
create policy "presence_write_admin" on public.merchant_presence
  for all using (public.is_admin()) with check (public.is_admin());

-- 6. Realtime: stream message inserts to subscribed (RLS-authorized) clients.
alter publication supabase_realtime add table public.conversation_messages;
