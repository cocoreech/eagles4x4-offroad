'use server'

// ============================================================
// Guest Concierge — anonymous, site-wide chat widget (see ADR-0004)
// ============================================================
// Same Concierge engine as the account-holder Inbox (src/app/inbox/actions.ts),
// extended to anonymous visitors. Identity is a session cookie + IP (never an
// account); every read/write goes through the service-role client since no
// anon RLS policy exists for guest_conversations/guest_messages/leads —
// mirrors how guest bookings already bypass RLS.

import { headers } from 'next/headers'
import { z } from 'zod'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getOrCreateGuestSessionId, getGuestSessionId } from '@/lib/guestSession'
import { createGuestInboxStore, type GuestMessage, type GuestConversationStatus } from '@/lib/inbox/guestStore'
import { hasLeadForConversation, createLead } from '@/lib/leads/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { sanitizeText } from '@/lib/sanitize'
import { buildConciergeSystemPrompt, type ConciergeContext, type GroundingPromo } from '@/lib/inbox/grounding'
import { generateConciergeReply, type ConciergeTurn } from '@/lib/inbox/concierge'
import { rlGuestChat, checkLimit, checkAiBudget, recordAiUsage, AI_SYSTEM_SCOPE_KEY } from '@/utils/ratelimit'
import { createNotificationStore } from '@/lib/notifications/store'

const ESCALATION_CONTACT_PROMPT =
  "Let me get the team to follow up on this — could you share your name and email (or phone) so they can reach you?"

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export interface GuestChatState {
  messages: GuestMessage[]
  /** True when the bot has escalated and no contact info has been captured yet — widget should show the capture form instead of the composer. */
  awaitingContact: boolean
}

async function buildState(admin: ReturnType<typeof createServiceRoleClient>, guestConversationId: string, status: GuestConversationStatus): Promise<GuestChatState> {
  const store = createGuestInboxStore(admin)
  const [messages, hasLead] = await Promise.all([
    store.listGuestMessages(guestConversationId),
    hasLeadForConversation(admin, guestConversationId),
  ])
  return { messages, awaitingContact: status === 'awaiting_merchant' && !hasLead }
}

/** Hydrate the widget on mount. Read-only — never creates a session/conversation. */
export async function getGuestConversation(): Promise<GuestChatState> {
  const sessionId = await getGuestSessionId()
  if (!sessionId) return { messages: [], awaitingContact: false }

  const admin = createServiceRoleClient()
  const store = createGuestInboxStore(admin)
  const convo = await store.findGuestConversationBySession(sessionId)
  if (!convo) return { messages: [], awaitingContact: false }

  return buildState(admin, convo.id, convo.status)
}

export async function sendGuestMessage(formData: FormData): Promise<{ error?: string } & Partial<GuestChatState>> {
  const sessionId = await getOrCreateGuestSessionId()
  const ip = await getIp()

  const limit = await checkLimit(rlGuestChat, `guest-send:${sessionId}:${ip}`)
  if (!limit.allowed) return { error: 'Too many messages. Please slow down.' }

  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const admin = createServiceRoleClient()
  const store = createGuestInboxStore(admin)

  try {
    const convo = await store.getOrCreateGuestConversation(sessionId, ip)

    // A blocked (awaiting-contact) conversation can't take another free-form
    // message — the widget should be showing the capture form instead.
    const hasLead = await hasLeadForConversation(admin, convo.id)
    if (convo.status === 'awaiting_merchant' && !hasLead) {
      return buildState(admin, convo.id, convo.status)
    }

    await store.insertGuestMessage({ guestConversationId: convo.id, sender: 'guest', body: parsed.data })
    await maybeRunGuestConcierge(admin, convo.id, sessionId, ip)

    const fresh = await store.findGuestConversationBySession(sessionId)
    return buildState(admin, convo.id, fresh?.status ?? convo.status)
  } catch (err) {
    console.error('[sendGuestMessage]', err)
    return { error: 'Could not send your message. Please try again.' }
  }
}

const contactSchema = z.object({
  name: z.string().transform(s => sanitizeText(s, 80)).refine(v => v.length >= 2, 'Please enter your name.'),
  email: z.string().transform(s => sanitizeText(s, 100).toLowerCase())
    .refine(v => /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(v), 'Please enter a valid email address.'),
  phone: z.string().transform(s => sanitizeText(s, 32)).optional(),
})

export async function submitGuestContact(formData: FormData): Promise<{ error?: string } & Partial<GuestChatState>> {
  const sessionId = await getGuestSessionId()
  if (!sessionId) return { error: 'Your chat session expired. Please send a message first.' }

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const admin = createServiceRoleClient()
  const store = createGuestInboxStore(admin)
  const convo = await store.findGuestConversationBySession(sessionId)
  if (!convo) return { error: 'Your chat session expired. Please send a message first.' }

  try {
    await createLead(admin, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      guestConversationId: convo.id,
    })
  } catch (err) {
    console.error('[submitGuestContact]', err)
    return { error: 'Could not save your info. Please try again.' }
  }

  // Let admins know a guest is waiting — otherwise the lead just sits silently.
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])
    const adminIds = (admins ?? []).map(a => a.id)
    if (adminIds.length > 0) {
      await createNotificationStore(admin).notifyCustomers(
        adminIds,
        'New chat lead',
        `${parsed.data.name} (${parsed.data.email}) left their contact info in the guest chat and is waiting for a reply.`,
        `/admin/inbox?tab=leads&c=${convo.id}`
      )
    }
  } catch (err) {
    console.error('[submitGuestContact] admin notify', err)
  }

  return buildState(admin, convo.id, convo.status)
}

// Run the AI concierge for a freshly-received guest message. Never throws.
async function maybeRunGuestConcierge(
  admin: ReturnType<typeof createServiceRoleClient>,
  guestConversationId: string,
  sessionId: string,
  ip: string,
): Promise<void> {
  try {
    const store = createGuestInboxStore(admin)

    // A human is present — let them answer, same rule as the account-holder Inbox.
    const merchantOnline = await admin.from('merchant_presence').select('merchant_id').eq('online', true).limit(1).maybeSingle()
    if (merchantOnline.data) return

    // Session + IP together — session alone is trivially reset by clearing
    // cookies, IP alone misfires under Philippine CGNAT (see ADR-0004).
    const budgetKey = `${sessionId}:${ip}`
    const budget = await checkAiBudget('guest', budgetKey)
    if (!budget.allowed) return // stays open; a human will pick it up when they're online

    const systemBudget = await checkAiBudget('system', AI_SYSTEM_SCOPE_KEY)
    if (!systemBudget.allowed) {
      console.error('[guest-concierge] system-wide AI budget exhausted')
      return
    }

    const [servicesRes, productsRes, promosRes, messages] = await Promise.all([
      admin.from('services').select('name, category, starting_price, duration_hours').eq('is_active', true),
      admin.from('products').select('name, brand, category, price, stock').eq('is_active', true),
      admin.from('events')
        .select('title, description, starts_at, ends_at')
        .eq('event_type', 'promo')
        .eq('is_published', true)
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`),
      store.listGuestMessages(guestConversationId),
    ])
    if (servicesRes.error || productsRes.error || promosRes.error) {
      console.error('[guest-concierge] grounding load', servicesRes.error ?? productsRes.error ?? promosRes.error)
      return
    }

    const promos: GroundingPromo[] = (promosRes.data ?? []).map(p => ({
      title: p.title, description: p.description, starts_at: p.starts_at, ends_at: p.ends_at,
    }))
    const ctx: ConciergeContext = {
      customerName: 'there',
      services: (servicesRes.data ?? []).map(s => ({
        name: s.name, category: s.category, starting_price: Number(s.starting_price), duration_hours: s.duration_hours,
      })),
      products: (productsRes.data ?? []).map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: Number(p.price), in_stock: Number(p.stock) > 0,
      })),
      promos,
      bookings: [], // guests have no bookings pre-signup
    }

    const history: ConciergeTurn[] = messages
      .slice(-10)
      .map(m => ({ role: m.sender === 'guest' ? 'user' : 'assistant', text: m.body }))

    const result = await generateConciergeReply({
      systemPrompt: buildConciergeSystemPrompt(ctx),
      history,
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    })
    if (!result.ok) {
      console.error('[guest-concierge] generate', result.error)
      return
    }

    await recordAiUsage('guest', budgetKey, result.costUsd)
    await recordAiUsage('system', AI_SYSTEM_SCOPE_KEY, result.costUsd)

    if (!result.needsHuman) {
      await store.insertGuestMessage({ guestConversationId, sender: 'bot', body: result.reply })
      return
    }

    // Escalation for an anonymous guest is only actionable once we have a way
    // to reach them — deterministic prompt, not the model's own words (ADR-0004).
    const hasLead = await hasLeadForConversation(admin, guestConversationId)
    if (hasLead) {
      await store.insertGuestMessage({ guestConversationId, sender: 'bot', body: result.reply })
    } else {
      await store.insertGuestMessage({ guestConversationId, sender: 'bot', body: ESCALATION_CONTACT_PROMPT })
    }
    await store.setGuestStatus(guestConversationId, 'awaiting_merchant')
  } catch (err) {
    console.error('[maybeRunGuestConcierge]', err)
  }
}
