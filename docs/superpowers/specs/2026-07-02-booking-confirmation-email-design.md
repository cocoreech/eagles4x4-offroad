# Booking Confirmation Email (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** [Touchpoints design](2026-06-17-touchpoints-design.md) (§2 "Confirmation email (Task 6) — DEFERRED"); `src/app/bookings/new/actions.ts` (`createBooking`); `src/app/bookings/[code]/success/page.tsx`

## 1. Summary

Send a **"booking received" email** when a booking is created, so a customer — especially a **guest** — always has a way back to their booking. Today the booking reference is shown only on the success page; if a guest doesn't save it, the booking is unrecoverable (no `/bookings` access without an account). This closes that gap by un-deferring the original Touchpoints "Task 6" confirmation email. It reuses the existing Resend adapter; it is best-effort and never blocks or fails a booking.

## 2. Scope

**In scope:**
- One transactional email on successful booking creation, to the booking's contact email.
- Applies to **both** guest and authenticated bookings (both always capture a valid `contactEmail`).
- Contents: booking reference code, schedule (date/time), services + total, a link to the public success page, shop contact line.
- A pure, unit-tested email-body builder + send via the existing `emailSender`.

**Out of scope (YAGNI):**
- A separate "payment confirmed" email — would require hooking the PayMongo webhook. The success page already reflects payment status.
- SMS/Viber/Messenger confirmation — email only (the success page + touchpoints cover the rest).
- Per-booking access tokens for the success URL (separate hardening, tracked in `PLAN-guest-checkout.md`).
- Any change to the batched-state model — this is a single send on the existing single submit.

## 3. Placement & flow

In `createBooking` (`src/app/bookings/new/actions.ts`), send the email **after the `booking_items` insert succeeds (step 7)** and **before** the payment/redirect branch (step 8). Both `redirect()` calls throw, so the send must precede them; placing it here means it fires on **both** the PayMongo path and the no-PayMongo path.

```
… insert booking (6) → insert booking_items (7)
   → [NEW] send confirmation email (best-effort)
   → payment / redirect (8)
```

All needed data is already in scope at that point: `booking.booking_code`, `d.contactEmail` (recipient), `d.scheduledDate`, `d.scheduledTime`, `subtotal`, and `services` (name + `starting_price`).

## 4. Error handling

Best-effort, non-blocking. The booking and its items already exist when the email is attempted; a send failure must not surface as a booking error. Wrap the send in `try/catch`, `console.error` on failure, and continue to the payment/redirect step. A missing `RESEND_API_KEY` behaves the same as any send failure (logged, ignored) — the booking still completes and the success page still works.

## 5. Recipient & abuse

Recipient is the booking's contact email (`d.contactEmail`) — schema-required and always present for guests and account-holders. **No new abuse gating is needed:** `createBooking` already rate-limits guests per-IP, per-email, and unique-emails-per-IP (the per-email throttle exists precisely to stop confirmation-email inbox-bombing). The email rides behind those existing checks.

## 6. Content

Subject: `Your Eagles 4x4 booking <CODE> is received`.

Body (plain text, matching the Resend `emailSender` `text` field):
- Greeting with the customer name.
- **Booking reference** (the code) — stated as the thing to keep.
- Schedule: date + time.
- Services (name × qty) and the total (₱).
- A link to the success page: `${NEXT_PUBLIC_SITE_URL}/bookings/<CODE>/success`.
- Honest status line: booking **received**; if a deposit is pending, it's confirmed once paid (do not claim "paid").
- Shop contact line (from `src/content/brand.ts`).

## 7. Components

- **`src/lib/bookings/confirmationEmail.ts`** — pure `buildBookingConfirmationEmail(input): { subject: string; body: string }`. `input` = `{ customerName, bookingCode, date, time, items: { name: string; quantity: number; lineTotal: number }[], total, successUrl, shopName, shopContact }`. No I/O.
- **`src/lib/bookings/confirmationEmail.test.ts`** — asserts subject contains the code; body contains the code, the success URL, and each service name.
- **`createBooking`** — assembles the input, calls the builder, and sends via `emailSender({ apiKey: RESEND_API_KEY, from: TOUCHPOINT_EMAIL_FROM })` (reused from `src/lib/touchpoints/channels.ts`).

Boundaries: the builder is pure and independently testable; the action owns the I/O (recipient resolution, sender construction, error swallowing). Same shape as the touchpoints `emailSender` reuse elsewhere.

## 8. Env / config

Reuses existing vars: `RESEND_API_KEY`, `TOUCHPOINT_EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL`. No new variables. Document nothing new beyond what `docs/deployment.md` already lists.

## 9. Testing

- **Unit (TDD):** `buildBookingConfirmationEmail` — code in subject + body, success URL present, all service names present, total rendered.
- **Runtime:** create a booking with a real `RESEND_API_KEY`; confirm the email arrives with a working success-page link, and that a booking still completes cleanly when the key is unset (email skipped, no error).

## 10. Build order

1. `buildBookingConfirmationEmail` + test (pure).
2. Wire the best-effort send into `createBooking` after step 7.
3. Verify (unit + runtime).
