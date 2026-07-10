-- 0023 — Admin "unreviewed bot reply" badge (ADR-0003)
--
-- The AI Concierge replies fully autonomously with no pre-send human
-- gate. This adds the detection signal for catching a confidently-wrong
-- reply after the fact: track the sender of each conversation's latest
-- message, and when an admin last opened it. /admin/inbox computes
-- "unreviewed" by comparing the two.

alter table public.conversations add column last_message_sender public.message_sender;
alter table public.conversations add column admin_reviewed_at timestamptz;
