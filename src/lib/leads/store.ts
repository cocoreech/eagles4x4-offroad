import type { SupabaseClient } from '@supabase/supabase-js'

export interface CreateLeadInput {
  name: string
  email: string
  phone?: string | null
  guestConversationId: string
}

/**
 * Captures contact info a guest gives when the Concierge needs to escalate
 * (see ADR-0004) — a Lead, not a profiles row, since it has no login
 * capability. Distinct from the query-based lead concept sourced from guest
 * bookings (src/lib/notifications/leads.ts); this is a real row so a chat
 * escalation's conversion can be tracked over time.
 */
export async function hasLeadForConversation(client: SupabaseClient, guestConversationId: string): Promise<boolean> {
  const { data, error } = await client
    .from('leads')
    .select('id')
    .eq('guest_conversation_id', guestConversationId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`hasLeadForConversation: ${error.message}`)
  return data !== null
}

export async function createLead(client: SupabaseClient, input: CreateLeadInput): Promise<{ id: string }> {
  const { data, error } = await client
    .from('leads')
    .insert({
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      source: 'guest_chat',
      guest_conversation_id: input.guestConversationId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createLead: ${error.message}`)
  return data as { id: string }
}
