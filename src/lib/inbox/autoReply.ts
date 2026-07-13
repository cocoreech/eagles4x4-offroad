import type { SupabaseClient } from '@supabase/supabase-js'
import { Anthropic } from '@anthropic-ai/sdk'

// Auto-reply to customer inbox messages a merchant hasn't answered. Runs as part
// of the daily touchpoints cron (Hobby plan caps us at 2 cron jobs + one run/day,
// so this piggybacks on the touchpoints run rather than its own schedule). The
// bot reads each unanswered message and replies contextually via Claude.

// A message is eligible once it has sat this long without a merchant reply. With
// a daily cron this mostly gates out messages posted in the last hour before the
// run — they get picked up on the next day's pass instead.
const AUTO_REPLY_DELAY_MINUTES = 60

async function generateContextualReply(customerMessage: string, customerName: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `You are a warm, friendly concierge from Eagles 4x4 Offroad shop in the Philippines.

A customer named "${customerName}" just sent you this message:
"${customerMessage}"

Analyze their message and write a SHORT, WARM reply (1-2 sentences max). Match their tone:
- If positive/happy: celebrate and thank them
- If asking a question: acknowledge it warmly
- If complaint/concern: empathize and assure them you're looking into it
- If neutral: be friendly and welcoming

Use casual Taglish mix (English + Tagalog). Include the customer's name. Keep it conversational, sound like a real person, not robotic. Add ONE emoji at the end.

IMPORTANT: Do NOT say "our team is reviewing" or "we're looking at this" — just respond warmly to what they said.

Reply with ONLY the message, nothing else.`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')
  return content.text.trim()
}

/**
 * Find customer messages older than the delay window with no merchant response,
 * and send each a contextual bot reply. Idempotent via bot_auto_replied_at:
 * a message that's already been auto-replied is skipped, so re-runs are safe.
 */
export async function runCustomerAutoReplies(
  client: SupabaseClient
): Promise<{ autoRepliesCount: number; processedMessages: number }> {
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - AUTO_REPLY_DELAY_MINUTES * 60 * 1000).toISOString()

  const { data: pendingMessages, error: queryError } = await client
    .from('conversation_messages')
    .select(
      `
      id, body, conversation_id, created_at,
      conversation:conversations (
        id, customer_id,
        customer:customer_id ( full_name, preferred_name )
      )
    `
    )
    .eq('sender', 'customer')
    .is('bot_auto_replied_at', null)
    .lt('created_at', cutoffTime)
    .order('created_at', { ascending: true })

  if (queryError) throw new Error(`Failed to query pending messages: ${queryError.message}`)

  let autoRepliesCount = 0

  for (const msg of pendingMessages || []) {
    // Skip if a merchant already responded after this customer message.
    const { data: merchantReplies, error: merchantError } = await client
      .from('conversation_messages')
      .select('id')
      .eq('conversation_id', msg.conversation_id)
      .eq('sender', 'merchant')
      .gt('created_at', msg.created_at)
      .limit(1)

    if (merchantError) throw new Error(`Failed to check merchant replies: ${merchantError.message}`)
    if ((merchantReplies?.length ?? 0) > 0) continue

    const convo = msg.conversation as unknown as {
      customer_id: string
      customer: { full_name: string | null; preferred_name: string | null }
    }
    const customerName = convo.customer?.preferred_name ?? convo.customer?.full_name ?? 'friend'
    const autoReplyBody = await generateContextualReply(msg.body as string, customerName)

    const { error: insertError } = await client.from('conversation_messages').insert({
      conversation_id: msg.conversation_id,
      sender: 'bot',
      body: autoReplyBody,
      needs_reply: false,
    })
    if (insertError) throw new Error(`Failed to insert auto-reply: ${insertError.message}`)

    const { error: updateError } = await client
      .from('conversation_messages')
      .update({ bot_auto_replied_at: now.toISOString() })
      .eq('id', msg.id)
    if (updateError) throw new Error(`Failed to mark auto-replied: ${updateError.message}`)

    autoRepliesCount++
  }

  return { autoRepliesCount, processedMessages: pendingMessages?.length ?? 0 }
}
