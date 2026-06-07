'use server'

// ============================================================
// Admin booking actions — advance status, cancel
// ============================================================
// SECURITY:
//  - requireAdmin() blocks non-admins server-side
//  - RLS bookings_update_admin policy also requires is_admin() on the DB
//  - Status changes auto-log to booking_status_history via DB trigger
//  - Rate-limited per admin to prevent runaway scripts updating thousands

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

const STATUS_PIPELINE = [
  'pending', 'confirmed', 'in_progress', 'parts_installed',
  'quality_check', 'ready', 'completed',
] as const

const advanceSchema = z.object({
  bookingId: z.string().uuid(),
  newStatus: z.enum([...STATUS_PIPELINE, 'cancelled']),
})

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

async function adminRateGuard(actor: string) {
  const result = await checkLimit(rlAdminGeneral, `admin-action:${actor}:${getIp()}`)
  return result.allowed
}

/**
 * Change a booking's status. Admin-only.
 */
export async function advanceStatus(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) {
    return { error: 'Too many admin actions. Please slow down.' }
  }

  const parsed = advanceSchema.safeParse({
    bookingId: formData.get('bookingId'),
    newStatus: formData.get('newStatus'),
  })
  if (!parsed.success) return { error: 'Invalid status change.' }

  const supabase = createClient()

  // Set completed_at if transitioning to completed
  const updates: Record<string, unknown> = { status: parsed.data.newStatus }
  if (parsed.data.newStatus === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', parsed.data.bookingId)

  if (error) {
    console.error('[advanceStatus]', error)
    return { error: 'Could not update status.' }
  }

  revalidatePath(`/admin/bookings`)
  revalidatePath(`/admin/bookings/${formData.get('bookingCode')}`)
  return { success: true }
}

/**
 * Cancel a booking (admin).
 */
export async function cancelBookingAdmin(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) {
    return { error: 'Too many admin actions. Please slow down.' }
  }

  const bookingId = String(formData.get('bookingId') ?? '')
  if (!z.string().uuid().safeParse(bookingId).success) {
    return { error: 'Invalid booking.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) {
    console.error('[cancelBookingAdmin]', error)
    return { error: 'Could not cancel booking.' }
  }

  revalidatePath(`/admin/bookings`)
  return { success: true }
}
