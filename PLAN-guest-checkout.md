# Implementation Plan: Guest Checkout Flow

## Overview

Refactor the booking flow from "sign in → book" to "book as guest → optionally create account afterward." Guests provide email to book; after payment confirmation, they see booking reference and are offered account creation (which auto-links their booking to the new account).

**Key constraint:** PayMongo checkout session is already working; we preserve that flow, just remove the auth gate.

---

## Architecture Decisions

1. **Guest bookings store `customer_id = NULL`** — keeps the two flows separate. Guest bookings are "claimed" when user creates account.
2. **Booking code is the permanent identifier** — guests use this to look up their booking in confirmation email, no account needed.
3. **Account creation happens post-payment** — lowest friction for booking conversion.
4. **Email is the bridge** — when guest creates account with same email, the system auto-links their guest bookings.
5. **No RLS changes required** — RLS policies already handle `NULL` customer_id via public guest access.

---

## Dependency Graph

```
Database Schema (no changes needed)
    │
    ├── createBooking action (allow guest email path)
    │       │
    │       ├── /bookings/new page (remove requireAuth)
    │       │
    │       └── BookingForm.tsx (add email field, remove default email)
    │
    ├── Payment Success Confirmation
    │       │
    │       ├── New /bookings/[code]/success page (replaces inline confirmation)
    │       │
    │       └── Email confirmation service (send receipt to guest email)
    │
    └── Account Linking
            │
            ├── /auth/register page (accept pre-filled email, link guest bookings)
            │
            └── Auth helper: linkGuestBookingsToNewUser (called after signup)
```

---

## Task List

### Phase 1: Core Guest Booking (No Auth Required)

#### Task 1: Remove auth guard from /bookings/new page
**Description:** Remove `requireAuth()` from `/bookings/new` so guests can access the form.

**Acceptance criteria:**
- [ ] `/bookings/new` page loads without redirecting unauthenticated users to `/login`
- [ ] Page still fetches services/products from DB
- [ ] No errors in browser console

**Verification:**
- [ ] Manual: Load `/bookings/new` in incognito window, form renders

**Dependencies:** None

**Files likely touched:**
- `src/app/bookings/new/page.tsx`

**Estimated scope:** XS

---

#### Task 2: Update BookingForm to accept guest email
**Description:** Modify BookingForm to allow entering email directly instead of reading from auth context. Guest bookings submit with email; authenticated users can auto-fill from their account.

**Acceptance criteria:**
- [ ] Unauthenticated user sees an email input field
- [ ] Email is required and validated (non-empty, valid email format)
- [ ] Authenticated user still gets their email pre-filled (if available)
- [ ] Form submission includes email in payload

**Verification:**
- [ ] Manual: Load form as guest, type email, verify field validates
- [ ] Manual: Load form as authenticated user, verify email is pre-filled

**Dependencies:** Task 1

**Files likely touched:**
- `src/app/bookings/new/BookingForm.tsx`
- `src/app/bookings/new/page.tsx` (pass user optional to form)

**Estimated scope:** M

---

#### Task 3: Modify createBooking action to handle guest path
**Description:** Update the server action to accept guest email and set `customer_id = null` for guest bookings. Authenticated users continue to use their JWT-verified user.id.

**Acceptance criteria:**
- [ ] Guest bookings (no user) create with `customer_id = NULL` in database
- [ ] Authenticated bookings still set `customer_id = user.id`
- [ ] Email validation works for both paths
- [ ] Rate limiting still works (use email for guests, user.id for authenticated)
- [ ] No breaking changes to existing authenticated booking flow

**Verification:**
- [ ] Tests pass: `npm test` (or manual DB inspection)
- [ ] Guest booking lands in DB with NULL customer_id
- [ ] Authenticated booking lands in DB with user.id

**Dependencies:** Task 2

**Files likely touched:**
- `src/app/bookings/new/actions.ts`
- `src/utils/ratelimit.ts` (handle guest email for rate limit key)

**Estimated scope:** M

---

### Checkpoint: Guest Booking Accepted
- [ ] Guests can fill form and submit (lands in DB)
- [ ] Authenticated users still work
- [ ] No auth redirects blocking the flow

---

### Phase 2: Payment & Confirmation

#### Task 4: Capture booking reference in PayMongo session
**Description:** Ensure `booking_code` is passed to and returned from PayMongo checkout session so we can show it in the success page.

**Acceptance criteria:**
- [ ] PayMongo session includes booking_code in metadata or description
- [ ] Booking code is retrievable after redirect from PayMongo
- [ ] No changes to PayMongo API client signature (backward compatible)

**Verification:**
- [ ] Manual: Create guest booking, go to payment, confirm checkout session has booking code

**Dependencies:** Task 3

**Files likely touched:**
- `src/lib/paymongo.ts` (include booking_code in session metadata)
- `src/app/bookings/new/actions.ts` (pass booking_code to createCheckoutSession)

**Estimated scope:** S

---

#### Task 5: Create /bookings/[code]/success page
**Description:** New success page that displays after PayMongo redirects back. Shows booking reference, next steps, and CTA to create account.

**Acceptance criteria:**
- [ ] Page loads when redirected from PayMongo with `checkout_session_id` query param
- [ ] Displays booking code prominently
- [ ] Shows booking summary (vehicle, services, total)
- [ ] Has clear CTA: "Create an Account to Track This Booking" (links to signup with email pre-filled)
- [ ] If user is already authenticated, redirect to `/bookings/[code]` instead
- [ ] Email confirmation is sent (see Task 6)

**Verification:**
- [ ] Manual: Complete guest payment, land on success page
- [ ] Manual: Success page shows correct booking code and details
- [ ] Manual: Click "Create Account" link and email is pre-filled in signup form

**Dependencies:** Task 4

**Files likely touched:**
- `src/app/bookings/[code]/success/page.tsx` (new)
- `src/app/bookings/[code]/success/layout.tsx` (optional, minimal nav)

**Estimated scope:** M

---

#### Task 6: Send confirmation email for guest bookings
**Description:** Add email service call to send booking confirmation to guest email after payment success. Must include booking code and link to view booking (no auth required for guests).

**Acceptance criteria:**
- [ ] Email is sent after booking + payment success
- [ ] Email includes booking code, vehicle details, scheduled date, total cost
- [ ] Email has link to view booking: `/bookings/[code]?key=<guest-access-key>` (optional secure token)
- [ ] Email is sent to the email address from the booking form
- [ ] No errors if email service fails (log and continue)

**Verification:**
- [ ] Manual: Complete guest booking, check inbox for confirmation email
- [ ] Email contains booking code and details

**Dependencies:** Task 3

**Files likely touched:**
- `src/lib/email.ts` (new or extend existing)
- `src/app/bookings/new/actions.ts` (call email service after booking creation)

**Estimated scope:** M

---

### Checkpoint: Payment & Confirmation Working
- [ ] Guest completes booking form
- [ ] Guest is redirected to PayMongo checkout
- [ ] After payment, guest sees confirmation page with booking code
- [ ] Guest receives confirmation email

---

### Phase 3: Account Linking

#### Task 7: Modify login/signup to offer pre-filling + auto-linking
**Description:** When guest navigates from success page to signup with email pre-filled, or when they sign up with an email that has existing guest bookings, auto-link those bookings to their new account.

**Acceptance criteria:**
- [ ] Signup form accepts pre-filled email from query param (e.g., `/auth/register?email=guest@example.com`)
- [ ] After signup completes, check if email has any guest bookings (customer_id = NULL)
- [ ] If yes, update those bookings to link to the new user (set customer_id = new_user.id)
- [ ] User is redirected to `/bookings` and can see their new bookings in the list
- [ ] No data loss; guest booking history is preserved

**Verification:**
- [ ] Manual: Sign up with email that has guest bookings, verify they appear in `/bookings`
- [ ] Database: Check booking.customer_id is updated after signup

**Dependencies:** Task 5

**Files likely touched:**
- `src/app/auth/register/page.tsx` (accept email query param)
- `src/app/auth/register/actions.ts` (add linkGuestBookingsToNewUser call after signup)
- `src/lib/auth.ts` (new helper function)

**Estimated scope:** M

---

#### Task 8: Modify /bookings/[code] page to work for guests (view-only)
**Description:** Update the booking detail page to allow guests to view their booking without auth. Guest access is read-only (no edits/payments unless they create account).

**Acceptance criteria:**
- [ ] `/bookings/[code]` can be loaded by guest with booking code (no auth required)
- [ ] Guest sees booking details but no payment/edit options
- [ ] Guest sees CTA: "Create an Account to Edit & Pay"
- [ ] Authenticated users see full interactive page (current behavior)
- [ ] Requires some form of access validation (e.g., secret token in URL or email verification)

**Verification:**
- [ ] Manual: Guest clicks email link (with token), sees booking details
- [ ] Manual: Guest tries to edit, sees prompt to sign up

**Dependencies:** Task 7

**Files likely touched:**
- `src/app/bookings/[code]/page.tsx` (add guest view mode)
- `src/lib/auth.ts` (guest access validation helper)

**Estimated scope:** M

---

### Checkpoint: Account Linking Complete
- [ ] Guest completes booking → payment → account signup
- [ ] New account automatically has the guest booking linked
- [ ] User sees their booking in `/bookings` immediately after signup

---

### Phase 4: Polish & Edge Cases

#### Task 9: Update booking queries to handle guests
**Description:** Ensure all booking queries (admin, customer views, API endpoints) handle `NULL customer_id` correctly and display appropriate info.

**Acceptance criteria:**
- [ ] Admin can see guest bookings in `/admin/bookings`
- [ ] Guest bookings display "Guest (email)" instead of customer name where applicable
- [ ] Booking lookup by code works for guests
- [ ] No SQL errors on NULL customer_id

**Verification:**
- [ ] Manual: Create guest booking, check admin panel
- [ ] Manual: Admin can see email, status, etc.

**Dependencies:** Task 3

**Files likely touched:**
- `src/app/admin/bookings/page.tsx`
- `src/app/admin/bookings/[code]/page.tsx`
- Any API endpoints that query bookings

**Estimated scope:** S

---

#### Task 10: Update existing routes that assume auth (guest edge cases)
**Description:** Review and fix any routes that assume user is authenticated but now might be hit by guests (e.g., form prefills, redirects).

**Acceptance criteria:**
- [ ] No 401/403 errors on guest-accessible pages
- [ ] Graceful handling of missing user context
- [ ] Guest-specific messaging where applicable

**Verification:**
- [ ] Manual: Walk through guest flow end-to-end without errors
- [ ] Build succeeds: `npm run build`

**Dependencies:** All Phase 1-3 tasks

**Files likely touched:**
- `src/components/PublicNav.tsx` (guest nav state)
- Any component that reads from auth context

**Estimated scope:** S

---

### Checkpoint: Complete & Verified
- [ ] All tests pass
- [ ] Build succeeds
- [ ] End-to-end guest flow works: browse → book → pay → success → email → signup → booking linked
- [ ] Authenticated flow still works (no regressions)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Guest bookings bypass payment validation if auth is removed carelessly | High | Keep rate limiting on email, validate email early, require payment before confirmation |
| Guests lose access to bookings if they can't find the email | Medium | Send clear confirmation email with booking code and direct link; offer help contact |
| Account linking creates duplicates if guest signs up with different email | Medium | Verify email match before linking; offer merge flow if duplicates exist |
| RLS policies break with NULL customer_id | High | Test RLS with guest bookings before merging; use explicit policies for guest access |
| Guests can't edit bookings after creation | Low | Acceptable for MVP; captured in Phase 3 Task 8 |

---

## Open Questions

- Do we need a guest access token (e.g., email verification token) or is the booking code sufficient for security?
- Should guests be able to pay again if they miss the first checkout link? (probably yes, Task 4 handles this)
- What happens to guest bookings if they never create an account? (forever orphaned, but searchable by booking code — acceptable)
- Do we need a "claim booking" page where guests verify email before linking? (Task 7 simplifies this by auto-linking post-signup)

---

## Implementation Notes

### Phase 1 (Tasks 1-3)
Low risk, high confidence. Guest bookings land in DB cleanly. Can parallelize Tasks 1-2.

### Phase 2 (Tasks 4-6)
Medium complexity. Requires PayMongo tweaks + email service. Task 4 is trivial; Tasks 5-6 are straightforward. Can parallelize Tasks 4 + 5 + 6.

### Phase 3 (Tasks 7-8)
Medium complexity. Auth linking is the trickiest part; requires careful handling of the signup flow. Must be sequential: Task 7 before Task 8.

### Phase 4 (Tasks 9-10)
Low risk, high confidence. Mostly cleanup. Can parallelize.

---

## Testing Strategy

1. **Manual** (recommended first): Walk through guest flow in browser, inspect DB
2. **Automated**: Add tests for guest booking creation, email sending, account linking
3. **RLS**: Verify guest bookings aren't exposed to wrong users
4. **Regression**: Confirm authenticated booking flow unchanged
