import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversation, ConversationMessage, ConversationStatus, MessageSender } from '@/types/inbox'

export function createInboxStore(client: SupabaseClient) {
  return {
    async getOrCreateConversation(customerId: string): Promise<Conversation> {
      const existing = await client
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle()
      if (existing.error) throw new Error(`getOrCreateConversation: ${existing.error.message}`)
      if (existing.data) return existing.data as Conversation

      const created = await client
        .from('conversations')
        .insert({ customer_id: customerId })
        .select('*')
        .single()
      if (created.error) throw new Error(`getOrCreateConversation insert: ${created.error.message}`)
      return created.data as Conversation
    },

    async listMessages(conversationId: string): Promise<ConversationMessage[]> {
      const { data, error } = await client
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`listMessages: ${error.message}`)
      return (data ?? []) as ConversationMessage[]
    },

    async insertMessage(input: {
      conversationId: string
      sender: MessageSender
      body: string
      bookingId?: string | null
    }): Promise<ConversationMessage> {
      const { data, error } = await client
        .from('conversation_messages')
        .insert({
          conversation_id: input.conversationId,
          sender: input.sender,
          body: input.body,
          booking_id: input.bookingId ?? null,
          // Customer messages need a reply; merchant/bot replies don't.
          needs_reply: input.sender === 'customer',
        })
        .select('*')
        .single()
      if (error) throw new Error(`insertMessage: ${error.message}`)

      const touch = await client
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_sender: input.sender,
          // A customer message flags the merchant to act; a merchant/bot reply
          // clears that flag so the "new" badge doesn't stick forever.
          status: input.sender === 'customer' ? 'awaiting_merchant' : 'open',
        })
        .eq('id', input.conversationId)
      if (touch.error) throw new Error(`insertMessage touch: ${touch.error.message}`)

      return data as ConversationMessage
    },

    async markRead(conversationId: string, reader: MessageSender): Promise<void> {
      // Mark the *other* party's messages as read.
      const senders: MessageSender[] =
        reader === 'merchant' ? ['customer'] : ['merchant', 'bot']
      const { error } = await client
        .from('conversation_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .is('read_at', null)
        .in('sender', senders)
      if (error) throw new Error(`markRead: ${error.message}`)
    },

    async hasUnreadForCustomer(customerId: string): Promise<boolean> {
      const { data: convo, error: convoErr } = await client
        .from('conversations')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle()
      if (convoErr) throw new Error(`hasUnreadForCustomer conversation: ${convoErr.message}`)
      if (!convo) return false

      const { data, error } = await client
        .from('conversation_messages')
        .select('id')
        .eq('conversation_id', convo.id)
        .is('read_at', null)
        .in('sender', ['merchant', 'bot'])
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`hasUnreadForCustomer messages: ${error.message}`)
      return data !== null
    },

    async markReviewedByAdmin(conversationId: string): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ admin_reviewed_at: new Date().toISOString() })
        .eq('id', conversationId)
      if (error) throw new Error(`markReviewedByAdmin: ${error.message}`)
    },

    async markDoorbellSent(conversationId: string): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ doorbell_sent_at: new Date().toISOString() })
        .eq('id', conversationId)
      if (error) throw new Error(`markDoorbellSent: ${error.message}`)
    },

    async isAnyMerchantOnline(): Promise<boolean> {
      const { data, error } = await client
        .from('merchant_presence')
        .select('merchant_id')
        .eq('online', true)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`isAnyMerchantOnline: ${error.message}`)
      return data !== null
    },

    async setStatus(conversationId: string, status: ConversationStatus): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ status })
        .eq('id', conversationId)
      if (error) throw new Error(`setStatus: ${error.message}`)
    },

    async listConversations(): Promise<(Conversation & { customer_name: string | null })[]> {
      const { data, error } = await client
        .from('conversations')
        .select('*, customer:profiles!customer_id ( full_name )')
        .order('last_message_at', { ascending: false, nullsFirst: false })
      if (error) throw new Error(`listConversations: ${error.message}`)
      return (data ?? []).map(
        (row: Conversation & { customer: { full_name: string | null } | null }) => ({
          ...row,
          customer_name: row.customer?.full_name ?? null,
        }),
      )
    },

    async listConversationsNeedingReply(): Promise<
      (Conversation & { customer_name: string | null; lastCustomerMessage: string | null })[]
    > {
      // Find conversations that have an unresponded customer message
      // (most recent message from customer with no merchant reply after it)
      const { data: conversations, error: convoError } = await client
        .from('conversations')
        .select('*, customer:profiles!customer_id ( full_name )')
        .order('last_message_at', { ascending: false, nullsFirst: false })
      if (convoError) throw new Error(`listConversationsNeedingReply: ${convoError.message}`)

      const result: (Conversation & { customer_name: string | null; lastCustomerMessage: string | null })[] =
        []

      // For each conversation, check if there's an unresponded customer message
      for (const row of conversations ?? []) {
        const convo = row as Conversation & { customer: { full_name: string | null } | null }

        // Get the most recent message
        const { data: lastMsg, error: lastMsgError } = await client
          .from('conversation_messages')
          .select('sender, body')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastMsgError) throw new Error(`listConversationsNeedingReply last msg: ${lastMsgError.message}`)

        // If last message is from customer, it needs a reply
        if (lastMsg?.sender === 'customer') {
          result.push({
            ...convo,
            customer_name: convo.customer?.full_name ?? null,
            lastCustomerMessage: lastMsg.body,
          })
        }
      }

      return result
    },
  }
}

export type InboxStore = ReturnType<typeof createInboxStore>
