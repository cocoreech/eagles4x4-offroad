import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversation, ConversationMessage, MessageSender } from '@/types/inbox'

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
        })
        .select('*')
        .single()
      if (error) throw new Error(`insertMessage: ${error.message}`)

      const touch = await client
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          // A customer message means the merchant must act; flag it.
          ...(input.sender === 'customer' ? { status: 'awaiting_merchant' } : {}),
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

    async markDoorbellSent(conversationId: string): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ doorbell_sent_at: new Date().toISOString() })
        .eq('id', conversationId)
      if (error) throw new Error(`markDoorbellSent: ${error.message}`)
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
  }
}

export type InboxStore = ReturnType<typeof createInboxStore>
