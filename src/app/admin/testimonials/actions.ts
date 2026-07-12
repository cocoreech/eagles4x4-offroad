'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `testimonials-action:${userId}:${await getIp()}`)
  return result.allowed
}

async function updateFeedback(id: string, patch: Record<string, unknown>) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid feedback id.' }

  const supabase = await createClient()
  const { error } = await supabase.from('booking_feedback').update(patch).eq('id', id)
  if (error) {
    console.error('[testimonials:update]', error)
    return { error: 'Could not save changes.' }
  }

  revalidatePath('/admin/testimonials')
  revalidatePath('/testimonials')
  return { success: true }
}

export async function rejectFeedback(formData: FormData) {
  return updateFeedback(String(formData.get('id') ?? ''), { moderation_status: 'rejected', published: false })
}

export async function publishFeedback(formData: FormData) {
  return updateFeedback(String(formData.get('id') ?? ''), { moderation_status: 'approved', published: true })
}

export async function unpublishFeedback(formData: FormData) {
  return updateFeedback(String(formData.get('id') ?? ''), { published: false })
}
