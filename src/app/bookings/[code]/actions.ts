'use server'

// ============================================================
// Customer booking actions — cancel & amend
// ============================================================
// Rules:
//   - Customer can cancel/amend only their OWN bookings (RLS enforces)
//   - Only allowed while status is 'pending' or 'confirmed'
//   - Amendment rules:
//       * Notes / contact / vehicle change → status stays
//       * Service or date/time change      → status reverts to 'pending' (re-approval)
//   - Old slot is freed automatically when scheduled_date/time changes

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { normalizeE164, getCountryByDial } from '@/lib/phone'
import { isValidMakeModel, ALLOWED_MAKES } from '@/lib/vehicles'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const EDITABLE_STATUSES = ['pending', 'confirmed'] as const

const cancelSchema = z.object({
  bookingCode: z.string().regex(/^EG-\d{4}-\d{4}$/, 'Invalid booking code.'),
})

/**
 * Cancel a booking owned by the current user.
 * Only allowed while status is pending or confirmed.
 */
export async function cancelMyBooking(formData: FormData) {
  const user = await requireAuth()
  // Rate-limit per user — prevents spamming cancel
  const rl = await checkLimit(rlServerAction, `cancel:${user.id}:${getIp()}`)
  if (!rl.allowed) return { error: 'Too many requests. Wait a moment and try again.' }

  const parsed = cancelSchema.safeParse({ bookingCode: formData.get('bookingCode') })
  if (!parsed.success) return { error: 'Invalid booking.' }

  const supabase = createClient()

  // Fetch the booking — RLS ensures we can only get our own
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, customer_id')
    .eq('booking_code', parsed.data.bookingCode)
    .maybeSingle()

  if (!booking)               return { error: 'Booking not found.' }
  if (booking.customer_id !== user.id) return { error: 'Not your booking.' }
  if (!EDITABLE_STATUSES.includes(booking.status as typeof EDITABLE_STATUSES[number])) {
    return { error: 'This booking can no longer be cancelled. Please contact the shop directly.' }
  }

  // RLS: customer can SELECT own but only admin can UPDATE bookings.
  // So we need a route: customer-side cancel uses the SERVICE ROLE client
  // (server-side only) to perform the update — but we've ALREADY verified
  // ownership above. This is the correct pattern: explicit ownership check
  // + service-role update for customer-initiated state changes.
  const { createServiceRoleClient } = await import('@/utils/supabase/server')
  const admin = createServiceRoleClient()

  const { error } = await admin
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking.id)
    .eq('customer_id', user.id)  // belt-and-suspenders

  if (error) {
    console.error('[cancelMyBooking]', error)
    return { error: 'Could not cancel. Please try again.' }
  }

  revalidatePath(`/bookings/${parsed.data.bookingCode}`)
  revalidatePath('/bookings')
  return { success: true }
}

// ─────────────────────────────────────────────
// AMEND BOOKING
// ─────────────────────────────────────────────

const amendSchema = z.object({
  bookingCode: z.string().regex(/^EG-\d{4}-\d{4}$/, 'Invalid booking code.'),
  serviceIds:  z.array(z.string().uuid()).min(1, 'Select at least one service.'),
  vehicleMake:         z.string().refine(v => ALLOWED_MAKES.includes(v), 'Pick a make from the list.'),
  vehicleModel:        z.string().min(1, 'Pick a model.'),
  vehicleYear:         z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicleTransmission: z.enum(['automatic', 'manual']).optional(),
  scheduledDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  scheduledTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time slot above'),
  contactPhone:        z.string().min(1),
  contactPhoneDial:    z.string().min(2),
  contactPhoneLocal:   z.string().min(1),
  contactEmail:        z.string()
                        .transform(s => sanitizeText(s, 100).toLowerCase())
                        .refine(v => /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v), 'Invalid email'),
  notes:               z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
}).superRefine((d, ctx) => {
  if (!isValidMakeModel(d.vehicleMake, d.vehicleModel)) {
    ctx.addIssue({ code: 'custom', path: ['vehicleModel'], message: 'Model does not match make.' })
  }
  const e164 = normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)
  if (!e164) {
    const c = getCountryByDial(d.contactPhoneDial)
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: c ? `Enter ${c.expectedLength} digits for ${c.name}.` : 'Bad country code.' })
  } else if (e164 !== d.contactPhone) {
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: 'Phone mismatch — please re-enter.' })
  }
})

/**
 * Amend a booking owned by the current user.
 * If date/time or services change → status reverts to 'pending'.
 * Otherwise status stays the same (no re-approval needed).
 */
export async function amendMyBooking(formData: FormData) {
  const user = await requireAuth()
  // Rate-limit per user — prevents amendment spam
  const rl = await checkLimit(rlServerAction, `amend:${user.id}:${getIp()}`)
  if (!rl.allowed) return { error: 'Too many requests. Wait a moment and try again.' }

  const serviceIds = formData.getAll('serviceIds').map(String)
  const parsed = amendSchema.safeParse({
    bookingCode:       formData.get('bookingCode'),
    serviceIds,
    vehicleMake:       formData.get('vehicleMake'),
    vehicleModel:      formData.get('vehicleModel'),
    vehicleYear:       formData.get('vehicleYear'),
    vehicleTransmission: formData.get('vehicleTransmission') || undefined,
    scheduledDate:     formData.get('scheduledDate'),
    scheduledTime:     formData.get('scheduledTime'),
    contactPhone:      formData.get('contactPhone'),
    contactPhoneDial:  formData.get('contactPhoneDial'),
    contactPhoneLocal: formData.get('contactPhoneLocal'),
    contactEmail:      formData.get('contactEmail'),
    notes:             formData.get('notes') || '',
  })

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = createClient()

  // Verify ownership + edit allowed
  const { data: booking } = await supabase
    .from('bookings')
    .select(`id, status, customer_id, scheduled_date, scheduled_time, vehicle_id,
             booking_items ( id, service_id, item_type )`)
    .eq('booking_code', d.bookingCode)
    .maybeSingle()

  if (!booking)               return { error: 'Booking not found.' }
  if (booking.customer_id !== user.id) return { error: 'Not your booking.' }
  if (!EDITABLE_STATUSES.includes(booking.status as typeof EDITABLE_STATUSES[number])) {
    return { error: 'Bookings in progress cannot be amended online. Please call the shop.' }
  }

  // Server-side slot validation (same as createBooking)
  const date = new Date(d.scheduledDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (date < today) return { error: 'Cannot move to a past date.' }
  if (date.getDay() === 0) return { error: 'Shop is closed on Sundays.' }
  const hour = parseInt(d.scheduledTime.slice(0, 2), 10)
  const allowedHours = date.getDay() === 6
    ? [8, 9, 10, 11, 13, 14, 15, 16]
    : [8, 9, 10, 11, 13, 14, 15, 16, 17]
  if (!allowedHours.includes(hour)) return { error: 'Time outside shop hours.' }

  // Detect what changed
  const dateChanged = booking.scheduled_date !== d.scheduledDate
  const timeChanged = String(booking.scheduled_time).slice(0, 5) !== d.scheduledTime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldServiceIds = ((booking as any).booking_items ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((i: any) => i.item_type === 'service')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((i: any) => i.service_id)
    .sort()
  const newServiceIds = [...d.serviceIds].sort()
  const servicesChanged = JSON.stringify(oldServiceIds) !== JSON.stringify(newServiceIds)

  const needsReapproval = dateChanged || timeChanged || servicesChanged

  // If date/time changed, check new slot has capacity
  if (dateChanged || timeChanged) {
    const { data: slotBookings } = await supabase
      .from('bookings')
      .select('id, scheduled_time')
      .eq('scheduled_date', d.scheduledDate)
      .neq('id', booking.id) // exclude THIS booking from the count
      .in('status', ['pending','confirmed','in_progress','parts_installed','quality_check','ready'])
    const sameHour = (slotBookings ?? []).filter(b =>
      parseInt(String(b.scheduled_time).slice(0, 2), 10) === hour
    )
    if (sameHour.length >= 3) {
      return { error: 'That new slot is full. Please pick another time.' }
    }
  }

  // Refetch services for new prices (in case admin updated prices since original booking)
  const { data: services } = await supabase
    .from('services')
    .select('id, name, starting_price')
    .in('id', d.serviceIds)
    .eq('is_active', true)
  if (!services || services.length !== d.serviceIds.length) {
    return { error: 'One or more services no longer available.' }
  }
  const subtotal = services.reduce((sum, s) => sum + Number(s.starting_price), 0)

  // Find/create vehicle row
  let vehicleId = booking.vehicle_id
  if (vehicleId) {
    // Update existing vehicle in place
    await supabase.from('vehicles').update({
      make: d.vehicleMake, model: d.vehicleModel, year: d.vehicleYear,
      transmission: d.vehicleTransmission ?? null,
    }).eq('id', vehicleId)
  } else {
    const { data: v } = await supabase.from('vehicles').insert({
      owner_id: user.id, make: d.vehicleMake, model: d.vehicleModel,
      year: d.vehicleYear, transmission: d.vehicleTransmission ?? null,
    }).select('id').single()
    vehicleId = v?.id ?? null
  }

  // Update booking — use service role since customer can't UPDATE bookings via RLS
  const { createServiceRoleClient } = await import('@/utils/supabase/server')
  const admin = createServiceRoleClient()

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      vehicle_id:     vehicleId,
      scheduled_date: d.scheduledDate,
      scheduled_time: d.scheduledTime,
      subtotal,
      total_amount:   subtotal,
      notes:          d.notes || null,
      contact_phone:  normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)!,
      contact_email:  d.contactEmail,
      status:         needsReapproval ? 'pending' : booking.status,
    })
    .eq('id', booking.id)
    .eq('customer_id', user.id)

  if (updateErr) {
    console.error('[amendMyBooking] update', updateErr)
    return { error: 'Could not save changes. Please try again.' }
  }

  // Replace booking_items: delete old service items, insert new ones
  if (servicesChanged) {
    await admin.from('booking_items').delete()
      .eq('booking_id', booking.id)
      .eq('item_type', 'service')

    await admin.from('booking_items').insert(
      services.map(s => ({
        booking_id:     booking.id,
        item_type:      'service' as const,
        service_id:     s.id,
        name_snapshot:  s.name,
        price_snapshot: s.starting_price,
        quantity:       1,
      }))
    )
  }

  redirect(`/bookings/${d.bookingCode}?amended=1`)
}
