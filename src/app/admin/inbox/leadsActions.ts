'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createGuestInboxStore } from '@/lib/inbox/guestStore'
import { messageBodySchema } from '@/lib/inbox/message'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const idSchema = z.string().uuid()

export async function sendLeadReply(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const limit = await checkLimit(rlAdminGeneral, `leads-admin-send:${user.id}:${await getIp()}`)
  if (!limit.allowed) return { error: 'Too many actions. Please slow down.' }

  const guestConversationId = idSchema.safeParse(formData.get('guestConversationId'))
  if (!guestConversationId.success) return { error: 'Invalid conversation.' }
  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const supabase = await createClient()
  const store = createGuestInboxStore(supabase)
  try {
    await store.insertGuestMessage({
      guestConversationId: guestConversationId.data,
      sender: 'merchant',
      body: parsed.data,
    })
    await store.setGuestStatus(guestConversationId.data, 'open')
  } catch (err) {
    console.error('[sendLeadReply]', err)
    return { error: 'Could not send the reply.' }
  }
  revalidatePath('/admin/inbox')
  return {}
}
