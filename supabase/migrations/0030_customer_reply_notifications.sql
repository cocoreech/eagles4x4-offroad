-- 0030 — Customer reply notifications and branch-scoped admin chats.
-- When a customer replies to a bot message, track if it needs a merchant response.
-- If no merchant responds within 1 hour, bot auto-replies with concierge tone.
-- Admins see branch-scoped customer conversations that need replies (real-time).

-- 1. Add tracking fields to conversation_messages
alter table public.conversation_messages
  add column needs_reply boolean not null default false,
  add column bot_auto_replied_at timestamptz;

-- needs_reply = true for customer messages until a merchant responds.
-- bot_auto_replied_at marks when bot sent the auto-reply (to prevent duplicates).

-- 2. Add branch to conversations (denormalized from customer's most recent booking)
-- for efficient filtering by branch admin.
alter table public.conversations
  add column branch text
  check (branch is null or branch in ('cavite', 'taguig', 'quezon-city', 'valenzuela'));

-- 3. Populate branch from customer's most recent booking
update public.conversations c
set branch = (
  select branch from public.bookings
  where customer_id = c.customer_id
  order by created_at desc
  limit 1
);

-- 4. Set needs_reply = true for all messages from customer sender where no merchant replied
-- Logic: if a message is from 'customer', mark it needs_reply unless there's a
-- 'merchant' message after it in the same conversation. This is complex as a trigger,
-- so we'll compute it in the app layer per query.

-- 5. Update RLS: branch-scoped admins can only see conversations for their branch
drop policy if exists "conv_select_own" on public.conversations;
create policy "conv_select_own" on public.conversations
  for select using (
    customer_id = auth.uid()
    or public.is_super_admin()
    or (public.is_admin() and branch = public.admin_branch())
  );

drop policy if exists "conv_insert_own" on public.conversations;
create policy "conv_insert_own" on public.conversations
  for insert with check (
    customer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "conv_update_admin_or_own" on public.conversations;
create policy "conv_update_admin_or_own" on public.conversations
  for update using (
    customer_id = auth.uid()
    or public.is_super_admin()
    or (public.is_admin() and branch = public.admin_branch())
  )
  with check (
    customer_id = auth.uid()
    or public.is_super_admin()
    or (public.is_admin() and branch = public.admin_branch())
  );

-- 6. Message RLS unchanged (inherits via conversation membership)
-- No changes needed — existing policies already check conversation membership.
