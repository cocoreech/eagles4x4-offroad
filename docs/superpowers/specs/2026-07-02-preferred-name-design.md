# Preferred Name & Ask-Once Booking (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** `src/app/bookings/new/` (`createBooking`, form), `src/lib/touchpoints/` (tokens/store), `src/lib/inbox/` (concierge, doorbell), `src/lib/bookings/confirmationEmail.ts`, migration 0013 (`contact_name`)

## 1. Summary

Ask the customer **once** for the name they want to be called ("What should we call you?"), store it, and use it as the greeting in **every** outbound message — booking confirmation email, touchpoint reminders/follow-ups, AI concierge replies, and inbox doorbell. `contact_name` stays as the full name for records; `preferred_name` is the greeting. A **returning signed-in customer is never re-asked** — their identity is pulled from their profile and they just pick service + date/time. Guests are asked each time and receive their booking details **by email** (the confirmation email already built).

## 2. Scope

**In scope:**
- `preferred_name` column on `bookings` and `profiles`.
- A "What should we call you?" field on `/bookings/new`, shown only when the value isn't already known.
- Signed-in prefill/skip: known account-holders skip the identity questions (name, preferred name, contact) — pulled from profile, still editable — and just choose service + date/time.
- First-time signed-in customers are asked once; the value is saved to `profiles.preferred_name`.
- Guests are asked each time; value saved on the booking (and carried to a profile later via `linkGuestBookings`).
- One shared greeting resolver used by all message surfaces.
- Threading the preferred name into: confirmation email, touchpoint tokens, AI concierge system prompt, doorbell email.

**Out of scope (YAGNI):**
- A separate account-settings screen to edit the preferred name (capture point is the booking form; can add later).
- Looking up a guest's name from a typed email before submit (privacy — would leak a name from an address).
- The other four admin features (products image, services delete, admin booking edit, editable availability) — each its own later spec.

## 3. Data model (migration 0016)

```
alter table public.bookings add column if not exists preferred_name text;
alter table public.profiles add column if not exists preferred_name text;
```
Both nullable; existing rows fall back via the resolver (§5). No enum/RLS changes.

## 4. Capture flow

**Signed-in customer** (`/bookings/new` loads their `profiles` row):
- Profile **has** `preferred_name` → the form does **not** ask for name/preferred-name/contact; it shows "Booking as *<preferred>* · <phone> — edit" and the customer picks service + date/time. Values are prefilled (editable) from the profile.
- Profile **lacks** `preferred_name` (first booking) → ask *"What should we call you?"* once. On submit, `createBooking` writes it to `bookings.preferred_name` **and** `profiles.preferred_name`.

**Guest** (not signed in) → the form always includes the preferred-name field (plus the existing full name + contact). Saved to `bookings.preferred_name`. If they later sign up with the same email, `linkGuestBookings` copies the most recent booking's `preferred_name` onto the new profile (so they're not re-asked next time).

`createBooking` schema gains `preferredName` (sanitized via `sanitizeText`, ≤ 40 chars, required for guests and first-time signed-in; ignored when the profile already supplies it).

## 5. Greeting resolver (one rule everywhere)

New pure helper `src/lib/name.ts`:
```
resolveGreetingName(input: { preferredName?: string | null; fullName?: string | null; contactName?: string | null }): string
// returns the first non-empty of: preferredName, fullName, contactName, then 'there'
```
Every surface calls this — no ad-hoc name logic. Unit-tested for the full fallback order and the `'there'` default.

## 6. Threading into messages

- **Confirmation email** (`createBooking` → `buildBookingConfirmationEmail`): pass `customerName = resolveGreetingName({ preferredName, fullName: user?...full_name, contactName })`.
- **Touchpoints** (`src/lib/touchpoints/store.ts` `toDueBooking`): select `bookings.preferred_name` and the profile's `preferred_name`; set `customer_name = resolveGreetingName({ preferredName: booking.preferred_name ?? profile.preferred_name, fullName: profile.full_name, contactName: booking.contact_name })`. Feeds `buildTokens` → every reminder/follow-up (email **and** inbox).
- **AI concierge** (`src/lib/inbox/grounding.ts` + `maybeRunConcierge`): add `customerName` to `ConciergeContext`; the system prompt gains a line — *"Address the customer as <name>."* `maybeRunConcierge` resolves it from `profiles.preferred_name` (fallback full_name). Today the concierge injects no name — this adds it.
- **Doorbell email** (already takes `customerName`): callers pass the resolved greeting name.

## 7. Guests get details by email only

Guests have no portal beyond the public success page. Their booking details reach them via the **confirmation email** (already built) — now greeting them by their preferred name and linking to `/bookings/[code]/success`. No account-only surfaces are exposed to guests.

## 8. Testing

- **Unit (TDD):** `resolveGreetingName` — preferred wins; falls back full → contact → `'there'`; trims/empty handled.
- **Unit:** confirmation email + touchpoint token tests updated to assert the preferred name appears.
- **Runtime:** first signed-in booking asks + saves to profile; second booking skips the ask and greets by preferred name; guest booking asks and the confirmation email greets by it.

## 9. Build order

1. Migration 0016 + `resolveGreetingName` (TDD).
2. Booking form field + `createBooking` capture (guest + signed-in prefill/skip + profile save).
3. Thread the resolver into confirmation email, touchpoints, concierge, doorbell (+ update affected tests).
4. Verify.
```
