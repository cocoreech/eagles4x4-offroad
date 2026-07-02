'use server'

// ============================================================
// Admin booking actions — advance status, cancel
// ============================================================
// SECURITY:
//  - requireAdmin() blocks non-admins server-side
//  - RLS bookings_update_admin policy also requires is_admin() on the DB
//  - Status changes auto-log to booking_status_history via DB trigger
//  - Rate-limited per admin to prevent runaway scripts updating thousands

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { normalizeE164, getCountryByDial } from '@/lib/phone'
import { resolveGreetingName } from '@/lib/name'
import { emailSender } from '@/lib/touchpoints/channels'
import { createTouchpointStore } from '@/lib/touchpoints/store'
import { rescheduleChanged, buildRescheduleMessage } from '@/lib/bookings/rescheduleNotice'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

const STATUS_PIPELINE = [
  'pending', 'confirmed', 'in_progress', 'parts_installed',
  'quality_check', 'ready', 'completed',
] as const

const advanceSchema = z.object({
  bookingId: z.string().uuid(),
  newStatus: z.enum([...STATUS_PIPELINE, 'cancelled']),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

async function adminRateGuard(actor: string) {
  const result = await checkLimit(rlAdminGeneral, `admin-action:${actor}:${await getIp()}`)
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

  const supabase = await createClient()

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

  const supabase = await createClient()
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

const adminEditSchema = z.object({
  bookingId:   z.string().uuid(),
  serviceIds:  z.array(z.string().uuid()).min(1, 'Select at least one service.'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.'),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time.'),
  contactName:  z.string().transform(s => sanitizeText(s, 80)).refine(v => v.length >= 2, 'Name required.'),
  preferredName: z.string().transform(s => sanitizeText(s, 40)).refine(v => v.length >= 1, 'Preferred name required.'),
  contactPhone:     z.string().min(1),
  contactPhoneDial: z.string().min(2),
  contactPhoneLocal: z.string().min(1),
  contactEmail: z.string().transform(s => sanitizeText(s, 100).toLowerCase())
                 .refine(v => /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), 'Invalid email.'),
  notes: z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
}).superRefine((d, ctx) => {
  const e164 = normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)
  if (!e164) {
    const c = getCountryByDial(d.contactPhoneDial)
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: c ? `Enter ${c.expectedLength} digits for ${c.name}.` : 'Bad country code.' })
  } else if (e164 !== d.contactPhone) {
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: 'Phone mismatch — please re-enter.' })
  }
})

// Admin edits any booking (override: no hours/capacity/closed checks). On a
// date/time change, notifies the customer to confirm or reschedule.
export async function adminUpdateBooking(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }

  const serviceIds = formData.getAll('serviceIds').map(String)
  const parsed = adminEditSchema.safeParse({
    bookingId: formData.get('bookingId'),
    serviceIds,
    scheduledDate: formData.get('scheduledDate'),
    scheduledTime: formData.get('scheduledTime'),
    contactName: formData.get('contactName') || '',
    preferredName: formData.get('preferredName') || '',
    contactPhone: formData.get('contactPhone'),
    contactPhoneDial: formData.get('contactPhoneDial'),
    contactPhoneLocal: formData.get('contactPhoneLocal'),
    contactEmail: formData.get('contactEmail'),
    notes: formData.get('notes') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const admin = createServiceRoleClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_code, customer_id, scheduled_date, scheduled_time, contact_email, contact_name, preferred_name')
    .eq('id', d.bookingId)
    .maybeSingle()
  if (!booking) return { error: 'Booking not found.' }

  const { data: services } = await admin
    .from('services')
    .select('id, name, starting_price')
    .in('id', d.serviceIds)
    .eq('is_active', true)
  if (!services || services.length !== d.serviceIds.length) {
    return { error: 'One or more services are no longer available.' }
  }
  const subtotal = services.reduce((sum, s) => sum + Number(s.starting_price), 0)

  const { error: updErr } = await admin
    .from('bookings')
    .update({
      scheduled_date: d.scheduledDate,
      scheduled_time: d.scheduledTime,
      subtotal,
      total_amount: subtotal,
      notes: d.notes || null,
      contact_phone: normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)!,
      contact_email: d.contactEmail,
      contact_name: d.contactName,
      preferred_name: d.preferredName,
    })
    .eq('id', booking.id)
  if (updErr) {
    console.error('[adminUpdateBooking] update', updErr)
    return { error: 'Could not save changes.' }
  }

  await admin.from('booking_items').delete().eq('booking_id', booking.id).eq('item_type', 'service')
  await admin.from('booking_items').insert(
    services.map(s => ({
      booking_id: booking.id,
      item_type: 'service' as const,
      service_id: s.id,
      name_snapshot: s.name,
      price_snapshot: s.starting_price,
      quantity: 1,
    })),
  )

  // Notify on reschedule (best-effort — never blocks the edit).
  if (rescheduleChanged(booking.scheduled_date, String(booking.scheduled_time), d.scheduledDate, d.scheduledTime)) {
    try {
      const name = resolveGreetingName({ preferredName: d.preferredName, contactName: d.contactName })
      const body = buildRescheduleMessage({ name, bookingCode: booking.booking_code, date: d.scheduledDate, time: d.scheduledTime })
      if (booking.customer_id) {
        const today = new Date().toISOString().slice(0, 10)
        await createTouchpointStore(admin, today).deliverToInbox({
          customerId: booking.customer_id,
          body,
          customerName: name,
          customerEmail: d.contactEmail,
          notifyByEmail: true,
        })
      } else if (d.contactEmail) {
        const sender = emailSender({
          apiKey: process.env.RESEND_API_KEY ?? '',
          from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
        })
        await sender.send({ to: d.contactEmail, subject: `Your booking ${booking.booking_code} was rescheduled`, body })
      }
    } catch (err) {
      console.error('[adminUpdateBooking] notify', err)
    }
  }

  revalidatePath(`/admin/bookings/${booking.booking_code}`)
  revalidatePath('/admin/bookings')
  redirect(`/admin/bookings/${booking.booking_code}?updated=1`)
}
