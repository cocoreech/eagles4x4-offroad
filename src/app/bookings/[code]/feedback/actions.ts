'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeMultiline } from '@/lib/sanitize'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const feedbackSchema = z.object({
  bookingCode: z.string().min(1),
  reaction: z.enum(['thumbs_down', 'thumbs_up', 'heart']),
  serviceQuality: z.coerce.number().int().min(1).max(5),
  installQuality: z.coerce.number().int().min(1).max(5),
  wouldRecommend: z.coerce.number().int().min(1).max(5),
  comment: z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
})

export async function submitFeedback(formData: FormData) {
  const user = await requireAuth()
  if (!(await checkLimit(rlServerAction, `feedback:${user.id}:${await getIp()}`)).allowed) {
    return { error: 'Too many attempts. Please slow down.' }
  }

  const parsed = feedbackSchema.safeParse({
    bookingCode: formData.get('bookingCode'),
    reaction: formData.get('reaction'),
    serviceQuality: formData.get('serviceQuality'),
    installQuality: formData.get('installQuality'),
    wouldRecommend: formData.get('wouldRecommend'),
    comment: formData.get('comment') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = await createClient()

  // RLS: only returns the booking if it belongs to this user, so ownership
  // is enforced by the query itself, not by a separate check.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, customer_id')
    .eq('booking_code', d.bookingCode)
    .maybeSingle()

  if (!booking) return { error: 'Booking not found.' }
  if (booking.customer_id !== user.id) return { error: 'This booking does not belong to your account.' }
  if (booking.status !== 'completed') return { error: 'Feedback is only available after your service is completed.' }

  const { error } = await supabase.from('booking_feedback').insert({
    booking_id: booking.id,
    customer_id: user.id,
    reaction: d.reaction,
    service_quality: d.serviceQuality,
    install_quality: d.installQuality,
    would_recommend: d.wouldRecommend,
    comment: d.comment || null,
  })

  if (error) {
    console.error('[submitFeedback]', error)
    return { error: error.code === '23505' ? 'You already left feedback for this booking.' : 'Could not save your feedback.' }
  }

  redirect(`/bookings/${d.bookingCode}/feedback?submitted=1`)
}
