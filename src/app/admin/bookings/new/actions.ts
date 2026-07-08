'use server'

// ============================================================
// Admin manual booking — search existing customers + create a booking
// ============================================================
// For phone-in / walk-in bookings the admin takes over the counter.
//  - searchCustomers: looks up existing customers by name/mobile/email so
//    the admin can auto-fill their details instead of retyping them.
//  - adminCreateBooking: creates the booking directly as 'confirmed' (the
//    admin IS the approval — there's no separate review step like the
//    public flow). No PayMongo checkout; deposit is handled in person.
//    No availability/capacity block — admin override, same reasoning as
//    adminUpdateBooking (the admin may be intentionally overbooking a
//    walk-in into an otherwise-full slot).

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { normalizeE164, getCountryByDial } from '@/lib/phone'
import { isValidMakeModel, ALLOWED_MAKES } from '@/lib/vehicles'
import { buildBookingConfirmationEmail } from '@/lib/bookings/confirmationEmail'
import { emailSender } from '@/lib/touchpoints/channels'
import { resolveGreetingName } from '@/lib/name'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'
import { brand } from '@/content/brand'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `admin-new-booking:${userId}:${await getIp()}`)
  return result.allowed
}

// ─────────────────────────────────────────────
// SEARCH — find existing customers by name / mobile / email
// ─────────────────────────────────────────────

export type CustomerMatch = {
  id: string
  fullName: string
  preferredName: string
  email: string
  phone: string
  vehicle: { make: string; model: string; year: number; transmission: string | null } | null
}

const searchSchema = z.object({ q: z.string().min(2, 'Type at least 2 characters.').max(100) })

export async function searchCustomers(formData: FormData): Promise<{ results: CustomerMatch[]; error?: string }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { results: [], error: 'Too many searches. Please slow down.' }

  const parsed = searchSchema.safeParse({ q: formData.get('q') })
  if (!parsed.success) return { results: [] }

  // PostgREST's .or() filter string is comma/paren-delimited — strip
  // characters that could alter the filter's meaning rather than just
  // matching text (defense against filter injection, not just XSS).
  const q = parsed.data.q.replace(/[(),%]/g, ' ').trim().slice(0, 100)
  if (q.length < 2) return { results: [] }

  const supabase = await createClient()
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, preferred_name, email, phone')
    .eq('role', 'customer')
    .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8)

  if (error) {
    console.error('[searchCustomers]', error)
    return { results: [], error: 'Search failed. Please try again.' }
  }
  if (!profiles || profiles.length === 0) return { results: [] }

  const ids = profiles.map(p => p.id)
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('owner_id, make, model, year, transmission')
    .in('owner_id', ids)

  const vehicleByOwner = new Map<string, { make: string; model: string; year: number; transmission: string | null }>()
  for (const v of vehicles ?? []) {
    if (!vehicleByOwner.has(v.owner_id)) {
      vehicleByOwner.set(v.owner_id, { make: v.make, model: v.model, year: v.year, transmission: v.transmission })
    }
  }

  return {
    results: profiles.map(p => ({
      id: p.id,
      fullName: p.full_name ?? '',
      preferredName: p.preferred_name ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      vehicle: vehicleByOwner.get(p.id) ?? null,
    })),
  }
}

// ─────────────────────────────────────────────
// CREATE — admin-entered booking (matched customer OR walk-in)
// ─────────────────────────────────────────────

const schema = z.object({
  branch:               z.enum(['cavite', 'taguig', 'quezon-city', 'valenzuela'], { message: 'Pick a branch.' }),
  customerId:          z.string().uuid().optional(),
  serviceIds:           z.array(z.string().uuid()).min(1, 'Select at least one service.'),
  vehicleMake:          z.string().refine(v => ALLOWED_MAKES.includes(v), 'Pick a make from the list.'),
  vehicleModel:         z.string().min(1, 'Pick a model.'),
  vehicleYear:          z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicleTransmission:  z.enum(['automatic', 'manual']).optional(),
  scheduledDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  scheduledTime:        z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time slot above'),
  contactName:          z.string().transform(s => sanitizeText(s, 80)).refine(v => v.length >= 2, 'Enter the customer’s name.'),
  preferredName:        z.string().transform(s => sanitizeText(s, 40)).refine(v => v.length >= 1, 'Enter a preferred name.'),
  contactPhone:         z.string().min(1, 'Enter a mobile number.'),
  contactPhoneDial:     z.string().min(2, 'Pick a country code.'),
  contactPhoneLocal:    z.string().min(1, 'Enter the digits after the country code.'),
  contactEmail:         z.string()
                         .transform(s => sanitizeText(s, 100).toLowerCase())
                         .refine(
                           v => /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(v),
                           'Please enter a valid email address.'
                         ),
  notes:                z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
}).superRefine((d, ctx) => {
  if (!isValidMakeModel(d.vehicleMake, d.vehicleModel)) {
    ctx.addIssue({ code: 'custom', path: ['vehicleModel'], message: 'Model does not match selected make.' })
  }
  const e164 = normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)
  if (!e164) {
    const country = getCountryByDial(d.contactPhoneDial)
    ctx.addIssue({
      code: 'custom',
      path: ['contactPhone'],
      message: country ? `Enter ${country.expectedLength} digits for ${country.name}.` : 'Pick a valid country code.',
    })
  } else if (e164 !== d.contactPhone) {
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: 'Phone number mismatch — please re-enter.' })
  }
})

export async function adminCreateBooking(formData: FormData) {
  const { user: admin, profile } = await requireAdmin()
  if (!(await adminRateGuard(admin.id))) return { error: 'Too many admin actions. Please slow down.' }

  // Branch-scoped admins can only create bookings for their own branch —
  // ignore whatever the client sent and use the assigned branch directly,
  // rather than merely validating it, so a tampered form can't slip a
  // different branch through. super_admin may pick any branch (checked
  // against the submitted value below).
  if (profile.role !== 'super_admin') {
    if (!profile.branch) {
      return { error: 'Your account has no branch assigned. Please sign out and sign in again.' }
    }
    formData.set('branch', profile.branch)
  }

  const serviceIds = formData.getAll('serviceIds').map(String)
  const rawCustomerId = formData.get('customerId')
  const parsed = schema.safeParse({
    branch:              formData.get('branch'),
    customerId:          rawCustomerId ? String(rawCustomerId) : undefined,
    serviceIds,
    vehicleMake:          formData.get('vehicleMake'),
    vehicleModel:         formData.get('vehicleModel'),
    vehicleYear:          formData.get('vehicleYear'),
    vehicleTransmission:  formData.get('vehicleTransmission') || undefined,
    scheduledDate:        formData.get('scheduledDate'),
    scheduledTime:        formData.get('scheduledTime'),
    contactName:          formData.get('contactName') || '',
    preferredName:        formData.get('preferredName') || '',
    contactPhone:         formData.get('contactPhone'),
    contactPhoneDial:     formData.get('contactPhoneDial'),
    contactPhoneLocal:    formData.get('contactPhoneLocal'),
    contactEmail:         formData.get('contactEmail') || '',
    notes:                formData.get('notes') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = await createClient()

  // If a search result was picked, confirm it's really a customer profile —
  // don't trust the id blindly even though it round-tripped through our own form.
  if (d.customerId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', d.customerId)
      .eq('role', 'customer')
      .maybeSingle()
    if (!profile) return { error: 'Selected customer not found. Please search again.' }
  }

  // Resolve the vehicle — same pattern as the public booking flow: an
  // authenticated customer's vehicle lives in its own row; a walk-in with
  // no account gets the vehicle snapshotted onto the booking directly.
  let vehicleId: string | null = null
  if (d.customerId) {
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
      .eq('owner_id', d.customerId)
      .eq('make', d.vehicleMake)
      .eq('model', d.vehicleModel)
      .eq('year', d.vehicleYear)
      .maybeSingle()

    if (existing) {
      vehicleId = existing.id
    } else {
      const { data: created, error: vehErr } = await supabase
        .from('vehicles')
        .insert({
          owner_id:     d.customerId,
          make:         d.vehicleMake,
          model:        d.vehicleModel,
          year:         d.vehicleYear,
          transmission: d.vehicleTransmission ?? null,
        })
        .select('id')
        .single()
      if (vehErr || !created) {
        console.error('[adminCreateBooking] vehicle insert', vehErr)
        return { error: 'Could not save the vehicle. Please try again.' }
      }
      vehicleId = created.id
    }
  }

  const { data: services, error: svcErr } = await supabase
    .from('services')
    .select('id, name, starting_price')
    .in('id', d.serviceIds)
    .eq('is_active', true)
  if (svcErr || !services || services.length !== d.serviceIds.length) {
    return { error: 'One or more selected services are no longer available.' }
  }
  const subtotal = services.reduce((sum, s) => sum + Number(s.starting_price), 0)

  // Admin-created bookings start CONFIRMED — the admin taking the call/walk-in
  // IS the confirmation step; there's no separate self-review loop like the
  // public flow's 'pending' status.
  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .insert({
      customer_id:     d.customerId ?? null,
      branch:          d.branch,
      vehicle_id:      vehicleId,
      scheduled_date:  d.scheduledDate,
      scheduled_time:  d.scheduledTime,
      status:          'confirmed',
      subtotal,
      labor_cost:      0,
      total_amount:    subtotal,
      notes:           d.notes || null,
      contact_phone:   normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)!,
      contact_email:   d.contactEmail,
      contact_name:    d.contactName,
      preferred_name:  d.preferredName,
      vehicle_make_snapshot:         d.customerId ? null : d.vehicleMake,
      vehicle_model_snapshot:        d.customerId ? null : d.vehicleModel,
      vehicle_year_snapshot:         d.customerId ? null : d.vehicleYear,
      vehicle_transmission_snapshot: d.customerId ? null : (d.vehicleTransmission ?? null),
    })
    .select('id, booking_code')
    .single()

  if (bookErr || !booking) {
    console.error('[adminCreateBooking] booking insert', bookErr)
    return { error: 'Could not create the booking. Please try again.' }
  }

  if (d.customerId) {
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ preferred_name: d.preferredName })
      .eq('id', d.customerId)
    if (profErr) console.error('[adminCreateBooking] profile preferred_name', profErr)
  }

  const itemsPayload = services.map(s => ({
    booking_id:     booking.id,
    item_type:      'service' as const,
    service_id:     s.id,
    name_snapshot:  s.name,
    price_snapshot: s.starting_price,
    quantity:       1,
  }))
  const { error: itemsErr } = await supabase.from('booking_items').insert(itemsPayload)
  if (itemsErr) {
    console.error('[adminCreateBooking] items insert', itemsErr)
    return { error: 'Booking created but services could not be attached. Booking code: ' + booking.booking_code }
  }

  // Best-effort confirmation email — booking is already persisted either way.
  try {
    const emailSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { subject, body } = buildBookingConfirmationEmail({
      customerName: resolveGreetingName({ preferredName: d.preferredName, contactName: d.contactName }),
      bookingCode: booking.booking_code,
      date: d.scheduledDate,
      time: d.scheduledTime,
      items: services.map(s => ({ name: s.name, quantity: 1, lineTotal: Number(s.starting_price) })),
      total: subtotal,
      successUrl: `${emailSiteUrl}/bookings/${booking.booking_code}/success`,
      shopName: brand.name,
      shopContact: `${brand.phone} · ${brand.email}`,
    })
    const sender = emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    })
    const res = await sender.send({ to: d.contactEmail, subject, body })
    if (!res.ok) console.error('[adminCreateBooking] confirmation email', res.error)
  } catch (err) {
    console.error('[adminCreateBooking] confirmation email', err)
  }

  redirect(`/admin/bookings/${booking.booking_code}?created=1`)
}
