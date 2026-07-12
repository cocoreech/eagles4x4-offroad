// ============================================================
// GET /api/cron/customer-replies — auto-reply to customer messages
// ============================================================
// Triggered every 30 minutes by Vercel Cron. Finds customer messages older
// than 1 hour with no merchant response and sends a contextual bot reply via Claude.
// Bot analyzes sentiment/intent and replies accordingly (celebrate positive,
// acknowledge questions, empathize with concerns). Prevents duplicate replies via
// bot_auto_replied_at timestamp.

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { Anthropic } from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}

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

async function sendAutoReplies() {
  const client = createServiceRoleClient()
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - AUTO_REPLY_DELAY_MINUTES * 60 * 1000).toISOString()

  // Find customer messages older than 1 hour that:
  // 1. Don't have a bot_auto_replied_at timestamp yet (not already replied)
  // 2. Don't have a merchant response after them
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

  // For each pending message, check if there's a merchant response after it
  for (const msg of pendingMessages || []) {
    const { data: merchantReplies, error: merchantError } = await client
      .from('conversation_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', msg.conversation_id)
      .eq('sender', 'merchant')
      .gt('created_at', msg.created_at)

    if (merchantError) throw new Error(`Failed to check merchant replies: ${merchantError.message}`)

    // Only send auto-reply if no merchant has responded since the customer message
    if ((merchantReplies?.length ?? 0) === 0) {
      const convo = msg.conversation as unknown as {
        customer_id: string
        customer: { full_name: string | null; preferred_name: string | null }
      }

      const customerName = convo.customer?.preferred_name ?? convo.customer?.full_name ?? 'friend'
      const customerMessage = msg.body as string

      // Generate contextual reply using Claude
      const autoReplyBody = await generateContextualReply(customerMessage, customerName)

      // Insert bot auto-reply
      const { error: insertError } = await client.from('conversation_messages').insert({
        conversation_id: msg.conversation_id,
        sender: 'bot',
        body: autoReplyBody,
        needs_reply: false,
      })

      if (insertError) throw new Error(`Failed to insert auto-reply: ${insertError.message}`)

      // Mark the original customer message as bot_auto_replied_at
      const { error: updateError } = await client
        .from('conversation_messages')
        .update({ bot_auto_replied_at: now.toISOString() })
        .eq('id', msg.id)

      if (updateError) throw new Error(`Failed to mark auto-replied: ${updateError.message}`)

      autoRepliesCount++
    }
  }

  return { autoRepliesCount, processedMessages: pendingMessages?.length ?? 0 }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendAutoReplies()
    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[customer-replies cron]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
