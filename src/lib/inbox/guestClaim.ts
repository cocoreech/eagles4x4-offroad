import { cookies } from 'next/headers'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { GUEST_SESSION_COOKIE } from '@/lib/guestSession'
import { createInboxStore } from '@/lib/inbox/store'
import { createGuestInboxStore } from '@/lib/inbox/guestStore'
import type { MessageSender } from '@/types/inbox'
import type { GuestMessageSender } from '@/lib/inbox/guestStore'

// Guest chat messages map onto the account thread's sender vocabulary: a guest
// is the account's 'customer'; 'bot' and 'merchant' carry straight across (an
// admin may have already replied to the lead before the guest signed up).
function mapSender(sender: GuestMessageSender): MessageSender {
  return sender === 'guest' ? 'customer' : sender
}

/**
 * When a guest signs up **in the same browser**, carry their anonymous chat
 * history into their new account's Inbox — matched on the guest session
 * cookie, deliberately NOT on email (see ADR-0004). Email-matching would
 * attach a shared/public computer's guest chat to whoever signs up next;
 * the cookie proves it's the same browser that held the conversation.
 *
 * Best-effort: never throws — a failure here must not block sign-in. Idempotent
 * — the source guest_conversation is deleted once copied, so a repeat call is a
 * no-op (and the one-year guest cookie is cleared so it can't linger).
 */
export async function claimGuestConversation(userId: string): Promise<number> {
  try {
    const store = await cookies()
    const sessionId = store.get(GUEST_SESSION_COOKIE)?.value
    if (!sessionId) return 0

    const admin = createServiceRoleClient()
    const guestStore = createGuestInboxStore(admin)

    const guestConvo = await guestStore.findGuestConversationBySession(sessionId)
    if (!guestConvo) {
      store.delete(GUEST_SESSION_COOKIE)
      return 0
    }

    const guestMessages = await guestStore.listGuestMessages(guestConvo.id)

    if (guestMessages.length > 0) {
      const inbox = createInboxStore(admin)
      const convo = await inbox.getOrCreateConversation(userId)

      // Bulk insert, preserving original timestamps so the migrated history
      // reads in order. read_at = created_at: the guest already saw these
      // replies, so they shouldn't resurface as unread on first login.
      const rows = guestMessages.map(m => ({
        conversation_id: convo.id,
        sender: mapSender(m.sender),
        body: m.body,
        created_at: m.created_at,
        read_at: m.sender !== 'guest' ? m.created_at : null,
      }))
      const inserted = await admin.from('conversation_messages').insert(rows)
      if (inserted.error) throw new Error(`claimGuestConversation insert: ${inserted.error.message}`)

      const last = guestMessages[guestMessages.length - 1]
      const touch = await admin
        .from('conversations')
        .update({ last_message_at: last.created_at, last_message_sender: mapSender(last.sender) })
        .eq('id', convo.id)
      if (touch.error) throw new Error(`claimGuestConversation touch: ${touch.error.message}`)
    }

    // A Lead captured during this conversation is now a real customer — mark it
    // converted (kept for conversion-rate history, filtered from the follow-up
    // queue), same "no delete" rule as email-matched Leads.
    await admin
      .from('leads')
      .update({ converted: true, converted_customer_id: userId })
      .eq('guest_conversation_id', guestConvo.id)
      .eq('converted', false)

    // Delete the source (cascades guest_messages) so the claim can't double-run,
    // then drop the now-spent cookie.
    await admin.from('guest_conversations').delete().eq('id', guestConvo.id)
    store.delete(GUEST_SESSION_COOKIE)

    return guestMessages.length
  } catch (err) {
    console.error('[claimGuestConversation]', err)
    return 0
  }
}
