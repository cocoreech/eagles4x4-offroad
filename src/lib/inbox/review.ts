import type { MessageSender } from '@/types/inbox'

/** True when the conversation's latest message is from the bot and no admin has opened it since — the ADR-0003 after-the-fact review signal. */
export function isUnreviewedBotReply(conv: {
  last_message_sender: MessageSender | null
  last_message_at: string | null
  admin_reviewed_at: string | null
}): boolean {
  if (conv.last_message_sender !== 'bot') return false
  if (!conv.last_message_at) return false
  if (!conv.admin_reviewed_at) return true
  return new Date(conv.admin_reviewed_at).getTime() < new Date(conv.last_message_at).getTime()
}
