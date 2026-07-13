-- 0033 — Let admin reply to guest chat leads (previously view-only).
-- Adds a 'merchant' sender to guest_messages (mirrors conversation_messages),
-- and RLS so an authenticated admin can insert replies + clear the
-- awaiting_merchant flag on the guest conversation.

alter table public.guest_messages drop constraint guest_messages_sender_check;
alter table public.guest_messages add constraint guest_messages_sender_check
  check (sender in ('guest', 'bot', 'merchant'));

create policy "guest_messages_admin_insert" on public.guest_messages
  for insert with check (public.is_admin());

create policy "guest_conversations_admin_update" on public.guest_conversations
  for update using (public.is_admin()) with check (public.is_admin());
