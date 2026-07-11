import type { SupabaseClient } from '@supabase/supabase-js'

export type GuestConversationStatus = 'open' | 'awaiting_merchant' | 'closed'
export type GuestMessageSender = 'guest' | 'bot'

export interface GuestConversation {
  id: string
  session_id: string
  ip: string | null
  status: GuestConversationStatus
  last_message_at: string | null
  created_at: string
}

export interface GuestMessage {
  id: string
  guest_conversation_id: string
  sender: GuestMessageSender
  body: string
  created_at: string
}

/** Mirrors src/lib/inbox/store.ts, but for anonymous (session-keyed, not customer-keyed) chats. */
export function createGuestInboxStore(client: SupabaseClient) {
  return {
    async getOrCreateGuestConversation(sessionId: string, ip: string): Promise<GuestConversation> {
      const existing = await client
        .from('guest_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()
      if (existing.error) throw new Error(`getOrCreateGuestConversation: ${existing.error.message}`)
      if (existing.data) return existing.data as GuestConversation

      const created = await client
        .from('guest_conversations')
        .insert({ session_id: sessionId, ip })
        .select('*')
        .single()
      if (created.error) throw new Error(`getOrCreateGuestConversation insert: ${created.error.message}`)
      return created.data as GuestConversation
    },

    async findGuestConversationBySession(sessionId: string): Promise<GuestConversation | null> {
      const { data, error } = await client
        .from('guest_conversations')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()
      if (error) throw new Error(`findGuestConversationBySession: ${error.message}`)
      return (data as GuestConversation | null) ?? null
    },

    async listGuestMessages(guestConversationId: string): Promise<GuestMessage[]> {
      const { data, error } = await client
        .from('guest_messages')
        .select('*')
        .eq('guest_conversation_id', guestConversationId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`listGuestMessages: ${error.message}`)
      return (data ?? []) as GuestMessage[]
    },

    async insertGuestMessage(input: {
      guestConversationId: string
      sender: GuestMessageSender
      body: string
    }): Promise<GuestMessage> {
      const { data, error } = await client
        .from('guest_messages')
        .insert({
          guest_conversation_id: input.guestConversationId,
          sender: input.sender,
          body: input.body,
        })
        .select('*')
        .single()
      if (error) throw new Error(`insertGuestMessage: ${error.message}`)

      const touch = await client
        .from('guest_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', input.guestConversationId)
      if (touch.error) throw new Error(`insertGuestMessage touch: ${touch.error.message}`)

      return data as GuestMessage
    },

    async setGuestStatus(guestConversationId: string, status: GuestConversationStatus): Promise<void> {
      const { error } = await client
        .from('guest_conversations')
        .update({ status })
        .eq('id', guestConversationId)
      if (error) throw new Error(`setGuestStatus: ${error.message}`)
    },
  }
}

export type GuestInboxStore = ReturnType<typeof createGuestInboxStore>
