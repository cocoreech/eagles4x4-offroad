// Shared inbox row + enum types. Mirror migration 0014 exactly.

export type ConversationStatus = 'open' | 'awaiting_merchant' | 'closed'
export type MessageSender = 'customer' | 'bot' | 'merchant'

export interface Conversation {
  id: string
  customer_id: string
  status: ConversationStatus
  last_message_at: string | null
  last_message_sender: MessageSender | null
  admin_reviewed_at: string | null
  doorbell_sent_at: string | null
  branch: string | null
  created_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender: MessageSender
  body: string
  booking_id: string | null
  read_at: string | null
  needs_reply: boolean
  bot_auto_replied_at: string | null
  created_at: string
}

export interface MerchantPresence {
  merchant_id: string
  online: boolean
  last_seen: string
}
