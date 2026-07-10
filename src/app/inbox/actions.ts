'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireConfirmed } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { buildConciergeSystemPrompt, type ConciergeContext, type GroundingBooking, type GroundingPromo } from '@/lib/inbox/grounding'
import { generateConciergeReply, type ConciergeTurn } from '@/lib/inbox/concierge'
import { resolveGreetingName } from '@/lib/name'
import { rlServerAction, checkLimit, checkAiBudget, recordAiUsage } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function sendCustomerMessage(formData: FormData): Promise<{ error?: string }> {
  const user = await requireConfirmed()
  const limit = await checkLimit(rlServerAction, `inbox-send:${user.id}:${await getIp()}`)
  if (!limit.allowed) return { error: 'Too many messages. Please slow down.' }

  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const supabase = await createClient()
  const store = createInboxStore(supabase)
  try {
    const convo = await store.getOrCreateConversation(user.id)
    await store.insertMessage({ conversationId: convo.id, sender: 'customer', body: parsed.data })
    await maybeRunConcierge(convo.id, user.id)
  } catch (err) {
    console.error('[sendCustomerMessage]', err)
    return { error: 'Could not send your message. Please try again.' }
  }
  revalidatePath('/inbox')
  return {}
}

// Reuses the booking shaping the touchpoint store already does.
const CONTEXT_BOOKING_SELECT = `
  booking_code, status,
  vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
  vehicles ( make, model, year ),
  booking_items ( name_snapshot, item_type )
`

interface RawContextBooking {
  booking_code: string
  status: string
  vehicle_make_snapshot: string | null
  vehicle_model_snapshot: string | null
  vehicle_year_snapshot: number | null
  vehicles: { make: string | null; model: string | null; year: number | null } | null
  booking_items: { name_snapshot: string; item_type: string }[] | null
}

function bookingVehicleLabel(b: RawContextBooking): string {
  const v = b.vehicles
  const make = v?.make ?? b.vehicle_make_snapshot
  const model = v?.model ?? b.vehicle_model_snapshot
  const year = v?.year ?? b.vehicle_year_snapshot
  if (!make && !model) return 'your vehicle'
  return [year, make, model].filter(Boolean).join(' ').trim()
}

function bookingServiceName(b: RawContextBooking): string {
  return (b.booking_items ?? []).find(i => i.item_type === 'service')?.name_snapshot ?? 'a service'
}

// Run the AI concierge for a freshly-received customer message. Never throws.
async function maybeRunConcierge(conversationId: string, customerId: string): Promise<void> {
  try {
    const admin = createServiceRoleClient()
    const store = createInboxStore(admin)

    // A human is present — let them answer.
    if (await store.isAnyMerchantOnline()) return

    const budget = await checkAiBudget('customer', customerId)
    if (!budget.allowed) return // stays awaiting_merchant; a human will pick it up

    // Build grounding context.
    const [servicesRes, productsRes, bookingsRes, promosRes, profileRes, messages] = await Promise.all([
      admin.from('services').select('name, category, starting_price, duration_hours').eq('is_active', true),
      admin.from('products').select('name, brand, category, price, stock').eq('is_active', true),
      admin.from('bookings').select(CONTEXT_BOOKING_SELECT).eq('customer_id', customerId).returns<RawContextBooking[]>(),
      admin.from('events')
        .select('title, description, starts_at, ends_at')
        .eq('event_type', 'promo')
        .eq('is_published', true)
        .lte('starts_at', new Date().toISOString())
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`),
      admin.from('profiles').select('preferred_name, full_name').eq('id', customerId).maybeSingle(),
      store.listMessages(conversationId),
    ])
    if (servicesRes.error || productsRes.error || bookingsRes.error || promosRes.error) {
      console.error('[concierge] grounding load', servicesRes.error ?? productsRes.error ?? bookingsRes.error ?? promosRes.error)
      return
    }

    const bookings: GroundingBooking[] = (bookingsRes.data ?? []).map(b => ({
      booking_code: b.booking_code,
      status: b.status,
      vehicle_label: bookingVehicleLabel(b),
      service_name: bookingServiceName(b),
    }))
    const promos: GroundingPromo[] = (promosRes.data ?? []).map(p => ({
      title: p.title, description: p.description, starts_at: p.starts_at, ends_at: p.ends_at,
    }))
    const ctx: ConciergeContext = {
      customerName: resolveGreetingName({
        preferredName: profileRes.data?.preferred_name,
        fullName: profileRes.data?.full_name,
      }),
      services: (servicesRes.data ?? []).map(s => ({
        name: s.name, category: s.category, starting_price: Number(s.starting_price), duration_hours: s.duration_hours,
      })),
      products: (productsRes.data ?? []).map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: Number(p.price), in_stock: Number(p.stock) > 0,
      })),
      promos,
      bookings,
    }

    // Last 10 turns, oldest→newest, role-mapped.
    const history: ConciergeTurn[] = messages
      .slice(-10)
      .map(m => ({ role: m.sender === 'customer' ? 'user' : 'assistant', text: m.body }))

    const result = await generateConciergeReply({
      systemPrompt: buildConciergeSystemPrompt(ctx),
      history,
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    })
    if (!result.ok) {
      console.error('[concierge] generate', result.error)
      return
    }

    await store.insertMessage({ conversationId, sender: 'bot', body: result.reply })
    // insertMessage set status to 'open' (non-customer sender). If the bot punted,
    // re-flag so the conversation surfaces in the admin queue.
    if (result.needsHuman) await store.setStatus(conversationId, 'awaiting_merchant')

    await recordAiUsage('customer', customerId, result.costUsd)
  } catch (err) {
    console.error('[maybeRunConcierge]', err)
  }
}
