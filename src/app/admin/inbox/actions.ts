'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { shouldSendDoorbell, sendDoorbellEmail } from '@/lib/inbox/doorbell'
import { resolveGreetingName } from '@/lib/name'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const idSchema = z.string().uuid()

export async function sendMerchantMessage(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const limit = await checkLimit(rlAdminGeneral, `inbox-admin-send:${user.id}:${await getIp()}`)
  if (!limit.allowed) return { error: 'Too many actions. Please slow down.' }

  const conversationId = idSchema.safeParse(formData.get('conversationId'))
  if (!conversationId.success) return { error: 'Invalid conversation.' }
  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const supabase = await createClient()
  const store = createInboxStore(supabase)
  try {
    await store.insertMessage({
      conversationId: conversationId.data,
      sender: 'merchant',
      body: parsed.data,
    })
    await store.markRead(conversationId.data, 'merchant')
    await maybeRingDoorbell(conversationId.data)
  } catch (err) {
    console.error('[sendMerchantMessage]', err)
    return { error: 'Could not send the message.' }
  }
  revalidatePath('/admin/inbox')
  return {}
}

interface ConversationWithCustomer {
  id: string
  doorbell_sent_at: string | null
  // Supabase types a to-one embed as an object here (matched on FK).
  customer: { email: string | null; full_name: string | null; preferred_name: string | null } | null
}

// Service-role: read the customer's email + doorbell state, decide, send, stamp.
async function maybeRingDoorbell(conversationId: string): Promise<void> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('conversations')
    .select('id, doorbell_sent_at, customer:profiles!customer_id ( email, full_name, preferred_name )')
    .eq('id', conversationId)
    .maybeSingle<ConversationWithCustomer>()
  if (error || !data) {
    if (error) console.error('[maybeRingDoorbell] load', error)
    return
  }
  const customer = data.customer
  if (!customer?.email) return
  if (!shouldSendDoorbell({ doorbellSentAt: data.doorbell_sent_at, now: new Date() })) return

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const res = await sendDoorbellEmail({
    to: customer.email,
    customerName: resolveGreetingName({ preferredName: customer.preferred_name, fullName: customer.full_name }),
    inboxUrl: `${base}/inbox`,
  })
  if (!res.ok) {
    console.error('[maybeRingDoorbell] send', res.error)
    return
  }
  const store = createInboxStore(admin)
  await store.markDoorbellSent(conversationId)
}

export async function setPresence(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const online = formData.get('online') === 'true'
  const supabase = await createClient()
  const { error } = await supabase
    .from('merchant_presence')
    .upsert({ merchant_id: user.id, online, last_seen: new Date().toISOString() })
  if (error) {
    console.error('[setPresence]', error)
    return { error: 'Could not update presence.' }
  }
  revalidatePath('/admin/inbox')
  return {}
}
