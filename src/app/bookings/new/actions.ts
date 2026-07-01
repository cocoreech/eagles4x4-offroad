'use server'

// ============================================================
// createBooking — server action for /bookings/new
// ============================================================
// Supports BOTH guest checkout and authenticated bookings.
//
// Security / identity:
//  - Identity is read from auth.getUser() server-side, never from the form.
//  - Authenticated: customer_id = verified user.id; written via the user's
//    RLS-scoped client (bookings_insert policy double-checks = auth.uid()).
//  - Guest (no user): customer_id = NULL. RLS (0002) already permits
//    anonymous inserts, but the SELECT policy is owner/admin-only, so guest
//    inserts go through the service-role client (so INSERT ... RETURNING works)
//    and the vehicle is snapshotted onto the booking rather than the
//    vehicles table (guests have no profile to own a vehicle row — see 0010).
//
// Rate limiting (multi-layer — see ratelimit.ts):
//  - Authenticated: per user.id+IP (rlServerAction).
//  - Guest: per IP (rlBookingsAnon) AND per email (rlBookingsAnon), plus a
//    unique-emails-per-IP cap (blocks bots cycling fake emails from one IP;
//    tuned for PH CGNAT-shared IPs).
//
// Flow: validate → rate-limit → slot check → vehicle → booking → items → pay.

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import {
  rlServerAction,
  rlBookingsAnon,
  checkLimit,
  checkUniqueEmailsPerIp,
} from '@/utils/ratelimit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { normalizeE164, getCountryByDial } from '@/lib/phone'
import { isValidMakeModel, ALLOWED_MAKES } from '@/lib/vehicles'
import { createCheckoutSession } from '@/lib/paymongo'
import { emailSender } from '@/lib/touchpoints/channels'
import { buildBookingConfirmationEmail } from '@/lib/bookings/confirmationEmail'
import { brand } from '@/content/brand'

// Make/Model now constrained to the allow-list in vehicles.ts.
// Phone is country-code + number → normalized to E.164 (+639XXXXXXXXX).
// Free-text fields still pass through sanitizeText/sanitizeMultiline.
const schema = z.object({
  serviceIds: z.array(z.string().uuid()).min(1, 'Select at least one service.'),
  vehicleMake:         z.string().refine(v => ALLOWED_MAKES.includes(v), 'Pick a make from the list.'),
  vehicleModel:        z.string().min(1, 'Pick a model.'),
  vehicleYear:         z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicleTransmission: z.enum(['automatic', 'manual']).optional(),
  scheduledDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  scheduledTime:       z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time slot above'),
  // PhoneInput posts both the assembled E.164 string AND the parts so we can
  // re-validate server-side rather than trusting the client-built string.
  contactName:         z.string()
                        .transform(s => sanitizeText(s, 80))
                        .refine(v => v.length >= 2, 'Please enter your name.'),
  contactPhone:        z.string().min(1, 'Enter your mobile number.'),
  contactPhoneDial:    z.string().min(2, 'Pick a country code.'),
  contactPhoneLocal:   z.string().min(1, 'Enter the digits after the country code.'),
  contactEmail:        z.string()
                        .transform(s => sanitizeText(s, 100).toLowerCase())
                        // Strict character set — blocks <, >, ', ", (), and any html-like input.
                        // Covers RFC-realistic emails (~99.99% of real-world addresses).
                        .refine(
                          v => /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(v),
                          'Please enter a valid email address.'
                        ),
  notes:               z.string().transform(s => sanitizeMultiline(s, 1000))
                        .optional(),
}).superRefine((d, ctx) => {
  // Cross-field: model must belong to the chosen make
  if (!isValidMakeModel(d.vehicleMake, d.vehicleModel)) {
    ctx.addIssue({ code: 'custom', path: ['vehicleModel'], message: 'Model does not match selected make.' })
  }
  // Cross-field: country code + local digits must produce a valid E.164
  const e164 = normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)
  if (!e164) {
    const country = getCountryByDial(d.contactPhoneDial)
    ctx.addIssue({
      code: 'custom',
      path: ['contactPhone'],
      message: country
        ? `Enter ${country.expectedLength} digits for ${country.name}.`
        : 'Pick a valid country code.',
    })
  } else if (e164 !== d.contactPhone) {
    // Client-submitted E.164 doesn't match what the parts produce → reject.
    ctx.addIssue({
      code: 'custom',
      path: ['contactPhone'],
      message: 'Phone number mismatch — please re-enter.',
    })
  }
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function createBooking(formData: FormData) {
  // 1. Parse form into a plain object (FormData multi-value handling)
  const serviceIds = formData.getAll('serviceIds').map(String)
  const parsed = schema.safeParse({
    serviceIds,
    vehicleMake:         formData.get('vehicleMake'),
    vehicleModel:        formData.get('vehicleModel'),
    vehicleYear:         formData.get('vehicleYear'),
    vehicleTransmission: formData.get('vehicleTransmission') || undefined,
    scheduledDate:       formData.get('scheduledDate'),
    scheduledTime:       formData.get('scheduledTime'),
    contactName:         formData.get('contactName') || '',
    contactPhone:        formData.get('contactPhone'),
    contactPhoneDial:    formData.get('contactPhoneDial'),
    contactPhoneLocal:   formData.get('contactPhoneLocal'),
    contactEmail:        formData.get('contactEmail') || '',
    notes:               formData.get('notes') || '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  // 2. Read the signed-in user from the JWT (never trust the form for identity).
  //    `user` is null for guests — that's the supported guest-checkout path.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Rate-limit. Authenticated users are limited per identity; guests have
  //    no identity, so we throttle by IP + email and cap unique emails per IP.
  const ip = await getIp()
  if (user) {
    const rl = await checkLimit(rlServerAction, `user:${user.id}:${ip}`)
    if (!rl.allowed) {
      return { error: 'Too many requests. Try again in a moment.' }
    }
  } else {
    // Layer 1: per-IP booking throttle (primary; tight in prod).
    const ipRl = await checkLimit(rlBookingsAnon, `ip:${ip}`)
    if (!ipRl.allowed) {
      return { error: 'Too many booking attempts. Please try again later.' }
    }
    // Layer 2: per-email throttle — stops one address being hammered (e.g.
    // bombing a victim's inbox with confirmation emails) from rotating IPs.
    const emailRl = await checkLimit(rlBookingsAnon, `email:${d.contactEmail}`)
    if (!emailRl.allowed) {
      return { error: 'Too many bookings for this email. Please try again later.' }
    }
    // Layer 3: unique-emails-per-IP — blocks a bot cycling many fake emails
    // through a single IP. Loose enough for CGNAT-shared mobile/household IPs.
    const uniq = await checkUniqueEmailsPerIp(ip, d.contactEmail)
    if (!uniq.allowed) {
      return { error: 'Too many booking attempts from your network. Please try again later.' }
    }
  }

  // Service-role client: used for guest writes (RLS SELECT is owner/admin-only,
  // so guest INSERT ... RETURNING must bypass RLS) and for the authoritative
  // slot-capacity count (RLS would otherwise hide other customers' bookings).
  const admin = createServiceRoleClient()

  // 3b. Server-side slot validation — reject past dates, closed days,
  //     and already-full slots. The client UI hides these, but a malicious
  //     client could POST anything, so we re-check here.
  const date = new Date(d.scheduledDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) return { error: 'Cannot book a past date.' }
  const sixMonthsOut = new Date(today)
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
  if (date > sixMonthsOut) return { error: 'Bookings open up to 6 months in advance.' }
  if (date.getDay() === 0) return { error: 'Shop is closed on Sundays.' }

  const hour = parseInt(d.scheduledTime.slice(0, 2), 10)
  const allowedHours = date.getDay() === 6
    ? [8, 9, 10, 11, 13, 14, 15, 16]
    : [8, 9, 10, 11, 13, 14, 15, 16, 17]
  if (!allowedHours.includes(hour)) {
    return { error: 'Selected time is outside shop hours.' }
  }

  // Count active bookings already in that slot. Must use the admin client:
  // the RLS SELECT policy is owner/admin-only, so the user-scoped client would
  // only see the caller's own bookings and let everyone overbook a full slot.
  const { data: slotBookings } = await admin
    .from('bookings')
    .select('id, scheduled_time, status')
    .eq('scheduled_date', d.scheduledDate)
    .in('status', ['pending','confirmed','in_progress','parts_installed','quality_check','ready'])
  const sameHour = (slotBookings ?? []).filter(b =>
    parseInt(String(b.scheduled_time).slice(0, 2), 10) === hour
  )
  if (sameHour.length >= 3) {
    return { error: 'That slot just filled up. Please pick another time.' }
  }

  // 4. Resolve the vehicle.
  //    - Authenticated: find an existing vehicle for this user or create one.
  //      RLS ensures we only see/own our own vehicles.
  //    - Guest: no profile to own a vehicle row, so we leave vehicle_id NULL
  //      and snapshot the details onto the booking instead (see step 6).
  let vehicleId: string | null = null
  if (user) {
    const { data: existing } = await supabase
      .from('vehicles')
      .select('id')
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
          owner_id:     user.id,
          make:         d.vehicleMake,
          model:        d.vehicleModel,
          year:         d.vehicleYear,
          transmission: d.vehicleTransmission ?? null,
        })
        .select('id')
        .single()
      if (vehErr || !created) {
        console.error('[createBooking] vehicle insert', vehErr)
        return { error: 'Could not save your truck info. Please try again.' }
      }
      vehicleId = created.id
    }
  }

  // 5. Look up the selected services + their current starting prices.
  //    We snapshot these into booking_items so future price changes don't
  //    affect the customer's quote. (Catalog is public-readable, so the
  //    user-scoped client works for guests too.)
  const { data: services, error: svcErr } = await supabase
    .from('services')
    .select('id, name, starting_price')
    .in('id', d.serviceIds)
    .eq('is_active', true)

  if (svcErr || !services || services.length !== d.serviceIds.length) {
    return { error: 'One or more selected services are no longer available.' }
  }

  const subtotal = services.reduce(
    (sum, s) => sum + Number(s.starting_price),
    0
  )

  // Guests write through the service-role client (RLS SELECT is owner/admin
  // only, so INSERT ... RETURNING would otherwise return nothing). Authenticated
  // users write through their RLS-scoped client, which the insert policy checks
  // against auth.uid().
  const writeClient = user ? supabase : admin

  // 6. Insert the booking. booking_code is auto-generated by the DB trigger.
  //    For guests we attach the vehicle snapshot; for authenticated users the
  //    vehicle lives in its own row referenced by vehicle_id.
  const { data: booking, error: bookErr } = await writeClient
    .from('bookings')
    .insert({
      customer_id:     user?.id ?? null,
      vehicle_id:      vehicleId,
      scheduled_date:  d.scheduledDate,
      scheduled_time:  d.scheduledTime,
      status:          'pending',
      subtotal,
      labor_cost:      0,
      total_amount:    subtotal,
      notes:           d.notes || null,
      // Store the SERVER-rebuilt E.164 string — never the raw client value
      contact_phone:   normalizeE164(d.contactPhoneDial, d.contactPhoneLocal)!,
      contact_email:   d.contactEmail || user?.email || null,
      contact_name:    d.contactName,
      // Vehicle snapshot — populated only for guests (vehicle_id is NULL).
      vehicle_make_snapshot:         user ? null : d.vehicleMake,
      vehicle_model_snapshot:        user ? null : d.vehicleModel,
      vehicle_year_snapshot:         user ? null : d.vehicleYear,
      vehicle_transmission_snapshot: user ? null : (d.vehicleTransmission ?? null),
    })
    .select('id, booking_code')
    .single()

  if (bookErr || !booking) {
    console.error('[createBooking] booking insert', bookErr)
    return { error: 'Could not create the booking. Please try again.' }
  }

  // 7. Insert booking_items rows (one per service)
  const itemsPayload = services.map(s => ({
    booking_id:     booking.id,
    item_type:      'service' as const,
    service_id:     s.id,
    name_snapshot:  s.name,
    price_snapshot: s.starting_price,
    quantity:       1,
  }))

  const { error: itemsErr } = await writeClient
    .from('booking_items')
    .insert(itemsPayload)

  if (itemsErr) {
    console.error('[createBooking] items insert', itemsErr)
    // Booking row exists but items failed — let the user know but don't roll back
    return {
      error: 'Booking created but services could not be attached. Please contact us with code ' + booking.booking_code,
    }
  }

  // 7b. Best-effort confirmation email — booking + items already persisted, so a
  //     failure here (incl. missing RESEND_API_KEY) is logged and ignored.
  try {
    const emailSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const { subject, body } = buildBookingConfirmationEmail({
      customerName: d.contactName,
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
    if (!res.ok) console.error('[createBooking] confirmation email', res.error)
  } catch (err) {
    console.error('[createBooking] confirmation email', err)
  }

  // 8. Create PayMongo checkout session for ₱500 deposit
  //    If PAYMONGO_SECRET_KEY isn't configured (early dev), skip payment
  //    and redirect straight to the booking page (deposit flow falls back).
  const depositCentavos = parseInt(process.env.NEXT_PUBLIC_BOOKING_DEPOSIT_CENTAVOS ?? '50000', 10)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const pkConfigured = !!process.env.PAYMONGO_SECRET_KEY && !process.env.PAYMONGO_SECRET_KEY.startsWith('<paste')

  if (!pkConfigured) {
    console.warn('[createBooking] PayMongo not configured — skipping deposit')
    redirect(`/bookings/${booking.booking_code}/success`)
  }

  try {
    const session = await createCheckoutSession({
      bookingId:    booking.id,
      bookingCode:  booking.booking_code,
      amountCentavos: depositCentavos,
      description:  `₱500 deposit to confirm booking ${booking.booking_code}`,
      successUrl:   `${siteUrl}/bookings/${booking.booking_code}/success?payment=success`,
      cancelUrl:    `${siteUrl}/bookings/${booking.booking_code}/success?payment=cancelled`,
      customerEmail: user?.email ?? d.contactEmail,
      customerPhone: normalizeE164(d.contactPhoneDial, d.contactPhoneLocal) ?? undefined,
    })

    // Save checkout session id on the booking for tracking + log it in payments
    await admin
      .from('bookings')
      .update({
        payment_intent_id: session.paymentIntentId,
        payment_amount:    depositCentavos / 100,
      })
      .eq('id', booking.id)

    await admin.from('payments').insert({
      booking_id:          booking.id,
      provider:            'paymongo',
      provider_session_id: session.id,
      provider_intent_id:  session.paymentIntentId,
      amount:              depositCentavos / 100,
      currency:            'PHP',
      status:              'initiated',
    })

    // Redirect customer to PayMongo's hosted checkout
    redirect(session.checkoutUrl)
  } catch (err) {
    console.error('[createBooking] checkout creation failed', err)
    // Booking row exists but no checkout — show the confirmation anyway.
    redirect(`/bookings/${booking.booking_code}/success?payment=error`)
  }
}
