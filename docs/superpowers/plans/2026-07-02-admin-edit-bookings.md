# Admin Edit Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Let admins edit a booking (date/time/services/contact/notes, availability-override) and notify the customer to confirm/reschedule when the date/time changes.

**Architecture:** `adminUpdateBooking` server action (admin-only, no availability enforcement) + a dedicated edit page/form mirroring the customer edit form; a pure reschedule-notice helper drives a best-effort inbox+doorbell (account-holders) or email (guests) notification.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-02-admin-edit-bookings-design.md](../specs/2026-07-02-admin-edit-bookings-design.md).

## Global Constraints

- **TS strict — no `any`/`as unknown`** (except mirroring existing `booking_items` any-casts already in the file).
- **Admin override:** no shop-hours/capacity/closed checks; only format/sanity validation.
- **Reuse primitives:** `createTouchpointStore(...).deliverToInbox` (inbox+doorbell), `emailSender`, `resolveGreetingName`, `normalizeE164`.
- **Never block the edit** on a notification failure.
- Admin guards: `requireAdmin` + `adminRateGuard` + Zod.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/bookings/rescheduleNotice.ts` | Create — pure helpers |
| `src/lib/bookings/rescheduleNotice.test.ts` | Create — tests |
| `src/app/admin/bookings/[code]/actions.ts` | Modify — `adminUpdateBooking` + notify |
| `src/app/admin/bookings/[code]/edit/page.tsx` | Create — edit page |
| `src/app/admin/bookings/[code]/edit/AdminEditBookingForm.tsx` | Create — form |
| `src/app/admin/bookings/[code]/page.tsx` | Modify — "Edit booking" link |

---

## Task 1: Reschedule-notice helpers (pure, TDD)

**Files:** Create `src/lib/bookings/rescheduleNotice.ts`, `src/lib/bookings/rescheduleNotice.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { rescheduleChanged, buildRescheduleMessage } from './rescheduleNotice'

describe('rescheduleChanged', () => {
  it('true when date changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-11', '14:00')).toBe(true)
  })
  it('true when time changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-10', '15:00')).toBe(true)
  })
  it('false when neither changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-10', '14:00')).toBe(false)
  })
})

describe('buildRescheduleMessage', () => {
  it('includes name, code, and the new date/time', () => {
    const m = buildRescheduleMessage({ name: 'JD', bookingCode: 'EG-2026-0001', date: '2026-07-11', time: '15:00' })
    expect(m).toContain('JD')
    expect(m).toContain('EG-2026-0001')
    expect(m).toContain('2026-07-11')
    expect(m).toContain('15:00')
    expect(m.toLowerCase()).toContain('confirm')
  })
})
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/lib/bookings/rescheduleNotice.test.ts`.

- [ ] **Step 3: Implement** — `src/lib/bookings/rescheduleNotice.ts`:

```ts
/** True when the booking's date or time changed (times compared as HH:MM). */
export function rescheduleChanged(oldDate: string, oldTime: string, newDate: string, newTime: string): boolean {
  return oldDate !== newDate || oldTime.slice(0, 5) !== newTime.slice(0, 5)
}

/** Message inviting the customer to confirm or reschedule after an admin move. */
export function buildRescheduleMessage(args: { name: string; bookingCode: string; date: string; time: string }): string {
  return `Hi ${args.name}! We've moved your booking ${args.bookingCode} to ${args.date} at ${args.time}. Reply here to confirm, or tell us if you'd prefer a different time.`
}
```

- [ ] **Step 4: Run → pass** (4 tests). **Commit** — `git add src/lib/bookings/rescheduleNotice.* && git commit -m "feat(admin): reschedule-notice helpers"`

---

## Task 2: `adminUpdateBooking` action + notification

**Files:** Modify `src/app/admin/bookings/[code]/actions.ts`

- [ ] **Step 1: Add imports** (below the existing imports):

```ts
import { redirect } from 'next/navigation'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { normalizeE164, getCountryByDial } from '@/lib/phone'
import { resolveGreetingName } from '@/lib/name'
import { emailSender } from '@/lib/touchpoints/channels'
import { createTouchpointStore } from '@/lib/touchpoints/store'
import { rescheduleChanged, buildRescheduleMessage } from '@/lib/bookings/rescheduleNotice'
import { createServiceRoleClient } from '@/utils/supabase/server'
```
(If `createClient` is already imported from `@/utils/supabase/server`, extend that import rather than duplicate.)

- [ ] **Step 2: Add the action** (after `cancelBookingAdmin`):

```ts
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

  // Replace service items.
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

  // Notify on reschedule (best-effort).
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
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/bookings/[code]/actions.ts` → clean. **Commit** — `feat(admin): adminUpdateBooking (override) + reschedule notification`.

---

## Task 3: Admin edit page + form + entry link

**Files:** Create `src/app/admin/bookings/[code]/edit/page.tsx` + `AdminEditBookingForm.tsx`; Modify `src/app/admin/bookings/[code]/page.tsx`

- [ ] **Step 1: Form** — `AdminEditBookingForm.tsx`: adapt `src/app/bookings/[code]/edit/EditBookingForm.tsx`:
  - import `{ adminUpdateBooking }` from the admin actions (`../actions`);
  - props add `bookingId: string`, `initial` gains `contactName`, `preferredName`;
  - hidden `bookingId` (instead of/in addition to bookingCode); submit calls `adminUpdateBooking`;
  - add **Full Name** (`contactName`) + **Preferred name** (`preferredName`) fields in the Contact section (prefilled);
  - drop the "reverts to pending" schedule warning; replace with "Admins can place any date/time.";
  - keep services multi-select, read-only vehicle, date/time, phone, email, notes.

- [ ] **Step 2: Page** — `edit/page.tsx` (RSC, `requireAdmin`): load the booking by `params.code` (id, booking_code, scheduled_date/time, notes, contact_*, preferred_name, `booking_items(service_id,item_type)`, vehicle snapshot/row) + active services; render `AdminEditBookingForm` with `initial` prefilled (serviceIds from booking_items where item_type='service'; contactPhone from `contact_phone`; vehicle from row or snapshot). Mirror the customer edit page's data shaping.

- [ ] **Step 3: Entry link** — in `src/app/admin/bookings/[code]/page.tsx`, add near `StatusControls`:

```tsx
          <div className="mt-4">
            <Link href={`/admin/bookings/${booking.booking_code}/edit`} className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
              Edit booking →
            </Link>
          </div>
```
(`Link` is already imported on that page.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/bookings` → clean. **Commit** — `feat(admin): admin edit booking page + form + entry link`.

---

## Task 4: Verification

- [ ] `npm run test` → green incl. `rescheduleNotice.test.ts` (4).
- [ ] `npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] Runtime: edit services → total + items update; reschedule an account-holder → inbox bot message + doorbell; reschedule a guest → email; contact-only edit → no notification.
- [ ] `git push origin feat/touchpoints`.

---

## Self-Review

**Spec coverage:** §3 action — T2 ✓; §4 UI — T3 ✓; §5 notification — T1/T2 ✓; §7 tests — T1/T4 ✓.
**Placeholder scan:** helper + action code complete; the form (T3) is a described adaptation of an existing file (no fabricated APIs).
**Type consistency:** `rescheduleChanged`/`buildRescheduleMessage` signatures match between T1 and T2; `deliverToInbox` args match the touchpoint-store method; `adminUpdateBooking` consumed by the form in T3.
```
