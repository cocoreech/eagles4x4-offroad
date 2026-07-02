# Admin Edit Bookings (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** `src/app/admin/bookings/[code]/` (detail + actions + StatusControls), `src/app/bookings/[code]/edit/EditBookingForm.tsx` (customer amend to mirror), inbox + doorbell + `emailSender` primitives

## 1. Summary

Let an admin manually edit a booking — reschedule, change services (recomputes total), fix contact (name / preferred name / phone / email), and edit notes — from a dedicated `/admin/bookings/[code]/edit` screen. Admins can **override** availability (place any valid date/time, even a closed day or a full slot). When an edit **changes the date or time**, the customer is notified to **confirm or reschedule** — into their inbox (account-holders) or by email (guests), reusing the existing two-way inbox loop.

## 2. Scope

**In scope:**
- `adminUpdateBooking` action: admin-only, edits date/time/services/contact/notes on any booking; no ownership check, no status gate, **no availability enforcement** (override) beyond format/sanity validation; recomputes `subtotal`/`total_amount`; replaces `booking_items` when services change.
- Admin edit page + form (mirrors the customer edit form) + an "Edit" link on the admin booking detail.
- Reschedule notification (date/time change): inbox bot message + doorbell for account-holders; email for guests. Best-effort.

**Out of scope (YAGNI):**
- Editing the vehicle on a booking (stays read-only).
- Unifying the customer `amendMyBooking`'s leftover hardcoded slot logic (separate concern).
- Status changes (already handled by `StatusControls`).
- Editing cancelled bookings is allowed but not specially handled.

## 3. `adminUpdateBooking` action

In `src/app/admin/bookings/[code]/actions.ts` (reuses `requireAdmin`, `adminRateGuard`, `createClient`, `z`):
- Validates: `bookingId` (uuid), `serviceIds` (≥1 uuid), `scheduledDate` (`YYYY-MM-DD`), `scheduledTime` (`HH:MM`), `contactName` (sanitized ≤80, ≥2), `preferredName` (sanitized ≤40, ≥1), phone (dial+local → E.164 via `normalizeE164`, cross-checked), `contactEmail` (sanitized/validated), `notes` (sanitized ≤1000, optional). **No shop-hours/capacity/closed checks** — admin override; only reject a malformed date/time.
- Loads the booking (by id) for the old date/time + `customer_id`/contact.
- Refetches the selected active services → `subtotal = sum(starting_price)`; `total_amount = subtotal`.
- Updates the booking (`scheduled_date/time`, `subtotal`, `total_amount`, `notes`, `contact_phone`, `contact_email`, `contact_name`, `preferred_name`) via the admin (RLS admin-update) client.
- If services changed, replaces the `service` `booking_items` (delete + insert snapshots), same as `amendMyBooking`.
- Returns `{ error }` on failure; on success `revalidatePath` the detail + `redirect` back to `/admin/bookings/[code]?updated=1`.
- **After a successful update, if the date or time changed → notify** (§5).

## 4. Admin edit UI

- `src/app/admin/bookings/[code]/edit/page.tsx` (RSC, `requireAdmin`): load the booking + active services; render `AdminEditBookingForm` prefilled.
- `src/app/admin/bookings/[code]/edit/AdminEditBookingForm.tsx` (`"use client"`): mirrors `EditBookingForm` — service multi-select (recompute subtotal), read-only vehicle, date/time, **contact name + preferred name** + phone + email + notes; hidden `bookingId`; submits `adminUpdateBooking` with inline error display. No "reverts to pending" warning (admin override).
- **Entry point:** an "Edit booking" link on `src/app/admin/bookings/[code]/page.tsx` near `StatusControls`.

## 5. Reschedule notification

A pure helper `src/lib/bookings/rescheduleNotice.ts`:
- `rescheduleChanged(oldDate, oldTime, newDate, newTime): boolean` (compares `HH:MM`).
- `buildRescheduleMessage({ bookingCode, date, time }): string` — e.g. *"Hi {name}! We've moved your booking {code} to {date} at {time}. Reply here to confirm, or tell us if you'd prefer a different time."* (name filled by caller via `resolveGreetingName`).

On a date/time change, best-effort (never blocks the edit):
- **Account-holder** (`customer_id`) → reuse the touchpoint store's `deliverToInbox({ customerId, body, customerName, customerEmail, notifyByEmail: true })` — posts a `sender='bot'` inbox message + doorbell; the customer's reply flows through the existing concierge/human loop.
- **Guest** (`contact_email`, no account) → send the same message by email via `emailSender`.
- Failures are `console.error`'d only.

## 6. Security

`requireAdmin` + `adminRateGuard` + Zod, exactly as the sibling admin actions. Booking writes use the admin (service-role or RLS-admin) client the file already uses. Override is intentional and admin-gated.

## 7. Testing

- **Unit (TDD):** `rescheduleChanged` (date change, time change, no change) and `buildRescheduleMessage` (contains code + new date/time).
- **Runtime:** edit a booking's services → total updates + items replaced; reschedule an **account-holder's** booking → inbox bot message + doorbell arrive and they can reply; reschedule a **guest's** booking → email arrives; a contact/notes-only edit sends **no** notification.

## 8. Build order

1. `rescheduleNotice` helpers (TDD).
2. `adminUpdateBooking` action + notification.
3. Admin edit page + form + detail "Edit" link.
4. Verify.
