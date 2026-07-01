# Booking Confirmation Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a best-effort "booking received" email on booking creation so guests (and account-holders) always have a link back to their booking.

**Architecture:** A pure `buildBookingConfirmationEmail` builder produces `{subject, body}`; `createBooking` calls it after the booking items are inserted and sends via the existing Resend `emailSender`, inside a try/catch so a send failure never affects the booking.

**Tech Stack:** Next.js 16 App Router (server action), TypeScript, Vitest, Resend (via `src/lib/touchpoints/channels.ts`).

**Spec:** [docs/superpowers/specs/2026-07-02-booking-confirmation-email-design.md](../specs/2026-07-02-booking-confirmation-email-design.md).

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.**
- **Reuse `emailSender`** from `src/lib/touchpoints/channels.ts` — no new dependency.
- **Best-effort, non-blocking:** the send is wrapped in try/catch and runs *after* the booking + items already persisted; a failure (including a missing `RESEND_API_KEY`) is `console.error`'d and ignored — the booking still completes and redirects.
- **No new env vars:** reuse `RESEND_API_KEY`, `TOUCHPOINT_EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`.
- **Copy is honest:** subject/body say "received", never "paid".
- **Peso formatting:** `'₱' + Number(n).toLocaleString('en-PH')` (matches the success page).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/bookings/confirmationEmail.ts` | Pure `buildBookingConfirmationEmail(input) → {subject, body}` |
| `src/lib/bookings/confirmationEmail.test.ts` | Unit tests for the builder |
| `src/app/bookings/new/actions.ts` | Send the email after items insert (modify) |

---

## Task 1: Confirmation email builder (pure, tested)

**Files:**
- Create: `src/lib/bookings/confirmationEmail.ts`
- Test: `src/lib/bookings/confirmationEmail.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `BookingConfirmationInput { customerName: string; bookingCode: string; date: string; time: string; items: { name: string; quantity: number; lineTotal: number }[]; total: number; successUrl: string; shopName: string; shopContact: string }`
  - `buildBookingConfirmationEmail(input: BookingConfirmationInput): { subject: string; body: string }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/bookings/confirmationEmail.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildBookingConfirmationEmail } from './confirmationEmail'

const input = {
  customerName: 'Juan',
  bookingCode: 'EAG-1001',
  date: '2026-07-10',
  time: '14:00',
  items: [
    { name: 'Suspension Lift', quantity: 1, lineTotal: 25000 },
    { name: 'Bull Bar', quantity: 2, lineTotal: 10000 },
  ],
  total: 35000,
  successUrl: 'https://eagles4x4.ph/bookings/EAG-1001/success',
  shopName: 'Eagles 4x4',
  shopContact: '0917 000 0000 · hello@eagles4x4.ph',
}

describe('buildBookingConfirmationEmail', () => {
  it('puts the booking code in the subject', () => {
    expect(buildBookingConfirmationEmail(input).subject).toContain('EAG-1001')
  })

  it('includes code, greeting, schedule, and the success link in the body', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body).toContain('Juan')
    expect(body).toContain('EAG-1001')
    expect(body).toContain('2026-07-10')
    expect(body).toContain('https://eagles4x4.ph/bookings/EAG-1001/success')
  })

  it('lists every service and the peso total', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body).toContain('Suspension Lift')
    expect(body).toContain('Bull Bar')
    expect(body).toContain('₱35,000')
  })

  it('shows quantity when more than one', () => {
    expect(buildBookingConfirmationEmail(input).body).toContain('Bull Bar × 2')
  })

  it('says received, never paid', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body.toLowerCase()).toContain('received')
    expect(body.toLowerCase()).not.toContain('paid')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bookings/confirmationEmail.test.ts`
Expected: FAIL — cannot find module `./confirmationEmail`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bookings/confirmationEmail.ts`:

```ts
export interface BookingConfirmationInput {
  customerName: string
  bookingCode: string
  date: string
  time: string
  items: { name: string; quantity: number; lineTotal: number }[]
  total: number
  successUrl: string
  shopName: string
  shopContact: string
}

const peso = (n: number) => '₱' + Number(n ?? 0).toLocaleString('en-PH')

/** Build the "booking received" confirmation email. Pure. */
export function buildBookingConfirmationEmail(input: BookingConfirmationInput): {
  subject: string
  body: string
} {
  const subject = `Your ${input.shopName} booking ${input.bookingCode} is received`

  const lines = input.items.map(it => {
    const label = it.quantity > 1 ? `${it.name} × ${it.quantity}` : it.name
    return `  - ${label}: ${peso(it.lineTotal)}`
  })

  const body = [
    `Hi ${input.customerName}!`,
    ``,
    `We've received your booking at ${input.shopName}. Save your booking reference — it's how you'll find this booking again:`,
    ``,
    `Booking reference: ${input.bookingCode}`,
    ``,
    `Schedule: ${input.date} at ${input.time}`,
    ``,
    `Services:`,
    ...lines,
    `  Total: ${peso(input.total)}`,
    ``,
    `View your booking anytime: ${input.successUrl}`,
    ``,
    `If a deposit is still pending, your slot is confirmed once it's paid — no need to pay again if you already did.`,
    ``,
    `Questions? Reach us at ${input.shopContact}.`,
  ].join('\n')

  return { subject, body }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bookings/confirmationEmail.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookings/confirmationEmail.ts src/lib/bookings/confirmationEmail.test.ts
git commit -m "feat(bookings): booking confirmation email builder"
```

---

## Task 2: Send the confirmation email from `createBooking`

**Files:**
- Modify: `src/app/bookings/new/actions.ts`

**Interfaces:**
- Consumes: `buildBookingConfirmationEmail` (Task 1); `emailSender` (`@/lib/touchpoints/channels`); `brand` (`@/content/brand`).
- Produces: nothing (side effect only).

The send goes **between** the successful `booking_items` insert (step 7) and the payment/redirect logic (step 8). It must precede the `redirect()` calls (which throw).

- [ ] **Step 1: Add imports**

In `src/app/bookings/new/actions.ts`, add to the import block (after the existing `@/lib/...` imports):

```ts
import { emailSender } from '@/lib/touchpoints/channels'
import { buildBookingConfirmationEmail } from '@/lib/bookings/confirmationEmail'
import { brand } from '@/content/brand'
```

- [ ] **Step 2: Insert the best-effort send**

Find the end of step 7 — the block that returns on `itemsErr`:

```ts
  if (itemsErr) {
    console.error('[createBooking] items insert', itemsErr)
    // Booking row exists but items failed — let the user know but don't roll back
    return {
      error: 'Booking created but services could not be attached. Please contact us with code ' + booking.booking_code,
    }
  }
```

Immediately **after** that `if (itemsErr) { … }` block (and before the `// 8. Create PayMongo …` comment), insert:

```ts
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
```

- [ ] **Step 3: Verify `brand` exports the fields used**

Confirm `src/content/brand.ts` exports `brand.name`, `brand.phone`, `brand.email` (the success page already uses `brand.phone`/`brand.email`).
Run: `npx tsc --noEmit`
Expected: no new errors. If `brand.phone`/`brand.email`/`brand.name` don't exist under those names, read `src/content/brand.ts` and use the correct field names, then re-run.

- [ ] **Step 4: Lint**

Run: `npx eslint src/app/bookings/new/actions.ts src/lib/bookings/`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/bookings/new/actions.ts
git commit -m "feat(bookings): send confirmation email on booking creation"
```

---

## Task 3: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all green, including the new `confirmationEmail.test.ts` (5).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. (If the build hits the disk constraint, record it and rely on the Vercel preview build.)

- [ ] **Step 3: Manual runtime verification**

With `RESEND_API_KEY` + `TOUCHPOINT_EMAIL_FROM` + `NEXT_PUBLIC_SITE_URL` set:
1. Create a **guest** booking → a "booking received" email arrives at the contact email with the reference code and a working success-page link.
2. Click the link → lands on `/bookings/<code>/success` showing that booking.
3. **Failure-safe check:** unset `RESEND_API_KEY`, create another booking → the booking still completes and redirects normally; a `[createBooking] confirmation email` line is logged; no user-facing error.

---

## Self-Review

**Spec coverage:**
- §3 placement (after items insert, before redirect) — Task 2 ✓
- §4 best-effort, non-blocking, missing-key safe — Task 2 (try/catch + `?? ''`) ✓
- §5 recipient = `d.contactEmail`; abuse covered by existing limits — Task 2 ✓
- §6 contents (code, schedule, services, total, success link, honest status, contact) — Task 1 builder + tests ✓
- §7 pure builder + reused `emailSender` — Tasks 1, 2 ✓
- §8 no new env vars — Task 2 reuses existing ✓
- §9 unit + runtime tests — Tasks 1, 3 ✓

**Placeholder scan:** none — all code is complete. The only conditional (Step 3 of Task 2) has an explicit fallback instruction.

**Type consistency:** `BookingConfirmationInput` / `buildBookingConfirmationEmail` (Task 1) are consumed with the exact field names in Task 2. `emailSender({apiKey, from}).send({to, subject, body})` matches the existing adapter signature in `channels.ts`.
