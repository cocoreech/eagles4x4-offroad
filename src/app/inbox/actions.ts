'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

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
  } catch (err) {
    console.error('[sendCustomerMessage]', err)
    return { error: 'Could not send your message. Please try again.' }
  }
  revalidatePath('/inbox')
  return {}
}
