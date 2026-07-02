# Preferred Name & Ask-Once Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a "what should we call you?" name once and greet the customer by it in every email, touchpoint, AI reply, and doorbell — asking returning signed-in customers only once and guests each time.

**Architecture:** Add `preferred_name` to `bookings` + `profiles`. One pure `resolveGreetingName()` helper computes the greeting everywhere. The booking form shows the preferred-name field only when it isn't already known; `createBooking` persists it (booking always; profile for signed-in) and every message surface resolves the greeting through the helper.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-02-preferred-name-design.md](../specs/2026-07-02-preferred-name-design.md).

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.**
- **One greeting rule:** every surface uses `resolveGreetingName()` — no ad-hoc name fallbacks.
- **Preferred name:** sanitized with `sanitizeText`, **≤ 40 chars**. Asked of guests + first-time signed-in; not re-asked when the profile already has it.
- **Persistence:** always on `bookings.preferred_name`; also on `profiles.preferred_name` for signed-in customers; carried onto a new profile by `linkGuestBookings`.
- **Guests get details by email only** (the existing confirmation email) — no account-only surface exposed.
- **Migration:** next number is `0016`; apply to live project `pkkgzsknvkpoowvukrqs` via the Supabase MCP.
- **No new env vars.**

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/0016_preferred_name.sql` | Create — `preferred_name` on `bookings` + `profiles` |
| `src/lib/name.ts` | Create — `resolveGreetingName` |
| `src/lib/name.test.ts` | Create — resolver tests |
| `src/app/bookings/new/page.tsx` | Modify — fetch profile preferred_name/phone/email; pass to form |
| `src/app/bookings/new/BookingForm.tsx` | Modify — preferred-name field (shown only when not known) |
| `src/app/bookings/new/actions.ts` | Modify — capture + persist preferred name; greet confirmation email via resolver |
| `src/lib/auth.ts` | Modify — `linkGuestBookings` copies preferred_name to profile |
| `src/lib/touchpoints/store.ts` | Modify — select + resolve preferred name into `customer_name` |
| `src/lib/inbox/grounding.ts` | Modify — inject customer name into concierge prompt |
| `src/lib/inbox/grounding.test.ts` | Modify — assert the name appears |
| `src/app/inbox/actions.ts` | Modify — resolve + pass customerName to concierge |
| `src/app/admin/inbox/actions.ts` | Modify — doorbell greeting via resolver + preferred_name |

---

## Task 1: Migration + greeting resolver (TDD)

**Files:**
- Create: `supabase/migrations/0016_preferred_name.sql`
- Create: `src/lib/name.ts`
- Test: `src/lib/name.test.ts`

**Interfaces:**
- Produces: `resolveGreetingName(input: { preferredName?: string | null; fullName?: string | null; contactName?: string | null }): string`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0016_preferred_name.sql`:

```sql
-- 0016 — Preferred greeting name ("what should we call you?").
-- contact_name stays as the full name; preferred_name is the greeting.
alter table public.bookings  add column if not exists preferred_name text;
alter table public.profiles  add column if not exists preferred_name text;
```

- [ ] **Step 2: Apply + verify on the live project**

Apply via Supabase MCP `apply_migration` (project `pkkgzsknvkpoowvukrqs`, name `0016_preferred_name`, SQL above). Then verify with MCP `execute_sql`:
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and column_name='preferred_name' order by table_name;
```
Expected: rows for `bookings` and `profiles`.

- [ ] **Step 3: Write the failing test**

Create `src/lib/name.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveGreetingName } from './name'

describe('resolveGreetingName', () => {
  it('prefers the preferred name', () => {
    expect(resolveGreetingName({ preferredName: 'JD', fullName: 'Juan Dela Cruz', contactName: 'Juan Dela Cruz' })).toBe('JD')
  })
  it('falls back to full name', () => {
    expect(resolveGreetingName({ preferredName: null, fullName: 'Juan Dela Cruz', contactName: 'x' })).toBe('Juan Dela Cruz')
  })
  it('falls back to contact name', () => {
    expect(resolveGreetingName({ fullName: '', contactName: 'Juan' })).toBe('Juan')
  })
  it("defaults to 'there' when nothing usable", () => {
    expect(resolveGreetingName({})).toBe('there')
    expect(resolveGreetingName({ preferredName: '   ' })).toBe('there')
  })
  it('trims whitespace', () => {
    expect(resolveGreetingName({ preferredName: '  JD  ' })).toBe('JD')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/lib/name.test.ts`
Expected: FAIL — cannot find module `./name`.

- [ ] **Step 5: Write the implementation**

Create `src/lib/name.ts`:

```ts
/** The single greeting-name rule: preferred → full → contact → 'there'. Pure. */
export function resolveGreetingName(input: {
  preferredName?: string | null
  fullName?: string | null
  contactName?: string | null
}): string {
  for (const candidate of [input.preferredName, input.fullName, input.contactName]) {
    const trimmed = candidate?.trim()
    if (trimmed) return trimmed
  }
  return 'there'
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/name.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0016_preferred_name.sql src/lib/name.ts src/lib/name.test.ts
git commit -m "feat(bookings): preferred_name column + greeting resolver"
```

---

## Task 2: Capture the preferred name in the booking flow

**Files:**
- Modify: `src/app/bookings/new/page.tsx`
- Modify: `src/app/bookings/new/BookingForm.tsx`
- Modify: `src/app/bookings/new/actions.ts`
- Modify: `src/lib/auth.ts`

**Interfaces:**
- Consumes: existing form/action wiring; `resolveGreetingName` (Task 1); `sanitizeText`.
- Produces: booking + profile carry `preferred_name`; confirmation email greets by it.

- [ ] **Step 1: Page — fetch profile fields, pass to form**

In `src/app/bookings/new/page.tsx`, widen the authenticated profile fetch and pass new props. Change the profile select from `select('full_name')` to:

```tsx
      ? supabase.from('profiles').select('full_name, preferred_name, phone, email').eq('id', user.id).maybeSingle()
```

And extend the `<BookingForm ... />` props (next to `defaultName={profile?.full_name ?? ''}`):

```tsx
            defaultName={profile?.full_name ?? ''}
            defaultPreferredName={profile?.preferred_name ?? ''}
            defaultPhone={profile?.phone ?? ''}
            defaultEmail={profile?.email ?? ''}
            hasPreferredName={!!profile?.preferred_name}
```

- [ ] **Step 2: Form — add the preferred-name field (shown only when not known)**

In `src/app/bookings/new/BookingForm.tsx`, add the props to the component's prop type and signature:

```tsx
  defaultPreferredName,
  defaultPhone,
  defaultEmail,
  hasPreferredName,
```
```tsx
  defaultPreferredName: string
  defaultPhone: string
  defaultEmail: string
  hasPreferredName: boolean
```

Then, immediately **above** the existing Full Name field (`name="contactName"`), render the preferred-name field only when it isn't already known; when it *is* known, submit it as a hidden input so the action still receives it:

```tsx
        {hasPreferredName ? (
          <input type="hidden" name="preferredName" value={defaultPreferredName} />
        ) : (
          <Field
            label="What should we call you?"
            name="preferredName"
            defaultValue={defaultPreferredName}
            placeholder="e.g. Juan, JD"
            required
            maxLength={40}
          />
        )}
```

Prefill the existing contact fields from the new defaults so a returning customer just reviews them: set `defaultValue={defaultPhone}` / `defaultValue={defaultEmail}` on the phone/email inputs (match the existing `Field`/`PhoneInput` prop names in the file). Keep the Full Name field prefilled from `defaultName` as today.

> Note: match the local `Field` component's actual prop names (`label`, `name`, `defaultValue`, `placeholder`, `required`, `maxLength`). If `Field` doesn't accept `maxLength`, add it (pass-through to the `<input>`).

- [ ] **Step 3: Action — validate, persist, greet**

In `src/app/bookings/new/actions.ts`:

(a) Add `preferredName` to the Zod schema (after `contactName`):

```ts
  preferredName:       z.string()
                        .transform(s => sanitizeText(s, 40))
                        .refine(v => v.length >= 1, 'Tell us what to call you.'),
```

(b) Add it to the `schema.safeParse({...})` object:

```ts
    preferredName:       formData.get('preferredName') || '',
```

(c) Persist on the booking insert — add to the `.insert({ ... })` object (next to `contact_name`):

```ts
      preferred_name:  d.preferredName,
```

(d) For signed-in customers, save it to the profile so they're not re-asked. After the booking insert succeeds (after the `if (bookErr || !booking) {...}` guard), add:

```ts
  // Persist the preferred name on the profile so returning customers aren't re-asked.
  if (user) {
    const { error: profErr } = await admin
      .from('profiles')
      .update({ preferred_name: d.preferredName })
      .eq('id', user.id)
    if (profErr) console.error('[createBooking] profile preferred_name', profErr)
  }
```

(e) Greet the confirmation email via the resolver. Add the import:

```ts
import { resolveGreetingName } from '@/lib/name'
```
and change the confirmation email's `customerName` (Task from the confirmation-email feature) to:

```ts
      customerName: resolveGreetingName({ preferredName: d.preferredName, fullName: user?.email ? d.contactName : d.contactName, contactName: d.contactName }),
```
(Effectively `preferredName ?? contactName`; `d.preferredName` is always present here.)

- [ ] **Step 4: `linkGuestBookings` — carry the name onto the new profile**

In `src/lib/auth.ts`, `linkGuestBookings` currently updates `bookings.customer_id`. After it links rows, copy the most recent linked booking's `preferred_name` to the profile if the profile has none. Replace the `.select('id')` on the update with `.select('id, preferred_name, created_at')` and, after a successful link, add:

```ts
    // Adopt the preferred name from the latest linked booking if the profile lacks one.
    const latest = (data ?? [])
      .filter(b => b.preferred_name)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]
    if (latest?.preferred_name) {
      await admin
        .from('profiles')
        .update({ preferred_name: latest.preferred_name })
        .eq('id', userId)
        .is('preferred_name', null)
    }
```

- [ ] **Step 5: Verify build + types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add src/app/bookings/new/page.tsx src/app/bookings/new/BookingForm.tsx src/app/bookings/new/actions.ts src/lib/auth.ts
git commit -m "feat(bookings): capture preferred name; skip ask for returning customers"
```

---

## Task 3: Thread the greeting into every message surface

**Files:**
- Modify: `src/lib/touchpoints/store.ts`
- Modify: `src/lib/inbox/grounding.ts`
- Modify: `src/lib/inbox/grounding.test.ts`
- Modify: `src/app/inbox/actions.ts`
- Modify: `src/app/admin/inbox/actions.ts`

**Interfaces:**
- Consumes: `resolveGreetingName` (Task 1).
- Produces: touchpoint tokens, concierge prompt, and doorbell all greet by preferred name.

- [ ] **Step 1: Touchpoints store — resolve preferred name**

In `src/lib/touchpoints/store.ts`:

(a) Import the resolver:
```ts
import { resolveGreetingName } from '@/lib/name'
```
(b) Add `preferred_name` to `BOOKING_SELECT` (top-level) and to the joined profile: change `customer:profiles!customer_id ( full_name )` to `customer:profiles!customer_id ( full_name, preferred_name )`, and add `preferred_name` to the top-level column list.
(c) Extend `RawBooking`: add `preferred_name: string | null` and change `customer` to `{ full_name: string | null; preferred_name: string | null } | null`.
(d) In `toDueBooking`, replace the `customer_name` line with:
```ts
    customer_name: resolveGreetingName({
      preferredName: b.preferred_name ?? b.customer?.preferred_name,
      fullName: b.customer?.full_name,
      contactName: b.contact_name,
    }),
```

- [ ] **Step 2: Concierge grounding — inject the name (red)**

In `src/lib/inbox/grounding.test.ts`, extend the `ctx` object with `customerName: 'JD'` and add a test:

```ts
  it('tells the bot how to address the customer', () => {
    const p = buildConciergeSystemPrompt({ ...ctx, customerName: 'JD' })
    expect(p).toContain('JD')
    expect(p).toMatch(/address the customer/i)
  })
```

Run: `npx vitest run src/lib/inbox/grounding.test.ts` → FAIL (customerName not in type / not rendered).

- [ ] **Step 3: Concierge grounding — implement**

In `src/lib/inbox/grounding.ts`, add `customerName: string` to `ConciergeContext`, and in `buildConciergeSystemPrompt` add a line near the top of the returned prompt (after the intro line):

```ts
Address the customer as ${ctx.customerName}.
```

Run: `npx vitest run src/lib/inbox/grounding.test.ts` → PASS. (The existing grounding tests must also pass — they construct `ctx` without `customerName`; update those `ctx` literals to include `customerName: 'there'`.)

- [ ] **Step 4: Concierge caller — resolve + pass the name**

In `src/app/inbox/actions.ts` `maybeRunConcierge`, fetch the customer's profile name alongside the grounding loads and pass it into the context. Add to the `Promise.all([...])`:

```ts
      admin.from('profiles').select('preferred_name, full_name').eq('id', customerId).maybeSingle(),
```
Capture it as `profileRes`, then set on the `ctx`:

```ts
      customerName: resolveGreetingName({
        preferredName: profileRes.data?.preferred_name,
        fullName: profileRes.data?.full_name,
      }),
```
Add the import `import { resolveGreetingName } from '@/lib/name'`.

- [ ] **Step 5: Admin doorbell — greet by preferred name**

In `src/app/admin/inbox/actions.ts` `maybeRingDoorbell`, the profile embed currently selects `email, full_name`. Add `preferred_name`, update the `ConversationWithCustomer.customer` type to include `preferred_name: string | null`, and change the `customerName` passed to `sendDoorbellEmail` to:

```ts
    customerName: resolveGreetingName({ preferredName: customer.preferred_name, fullName: customer.full_name }),
```
Add the import `import { resolveGreetingName } from '@/lib/name'`.

- [ ] **Step 6: Verify build + types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 7: Commit**

```bash
git add src/lib/touchpoints/store.ts src/lib/inbox/grounding.ts src/lib/inbox/grounding.test.ts src/app/inbox/actions.ts src/app/admin/inbox/actions.ts
git commit -m "feat(bookings): greet by preferred name in touchpoints, concierge, doorbell"
```

---

## Task 4: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all green, including `name.test.ts` (5) and the updated grounding tests.

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. (If the build hits the disk constraint, record it and rely on the Vercel preview build.)

- [ ] **Step 3: Manual runtime verification**

1. **First signed-in booking:** the "What should we call you?" field shows; submit → `profiles.preferred_name` is set (Supabase MCP `execute_sql`); confirmation email greets by it.
2. **Second signed-in booking:** the field is **absent** (hidden input carries the saved value); contact fields prefilled; the customer just picks service + date/time.
3. **Guest booking:** the field shows; confirmation email greets by the preferred name; `bookings.preferred_name` set.
4. **Touchpoint / concierge / doorbell:** a due touchpoint greets by preferred name; an inbox message from a named customer gets an AI reply that addresses them by it.

---

## Self-Review

**Spec coverage:**
- §3 data model — Task 1 ✓
- §4 capture (guest asked; signed-in first-time asked+saved; returning skipped; prefill) — Task 2 ✓
- §5 resolver — Task 1 ✓
- §6 threading (confirmation email, touchpoints, concierge, doorbell) — Tasks 2, 3 ✓
- §7 guest email-only — unchanged; confirmation email greets by preferred name (Task 2) ✓
- guest→profile carry via `linkGuestBookings` — Task 2 Step 4 ✓

**Placeholder scan:** none — all steps carry complete code. UI prop-name matching (Task 2 Step 2) has an explicit "match the local `Field` component" instruction.

**Type consistency:** `resolveGreetingName`'s input shape is identical across Tasks 1–3. `ConciergeContext.customerName` added in Task 3 Step 3 is set in Task 3 Step 4 and asserted in Step 2. Touchpoint `RawBooking.preferred_name` + profile embed match the `toDueBooking` usage.

**Dependency note:** Task 2 Step 3(e) edits the confirmation-email call added by the earlier `2026-07-02-booking-confirmation-email` plan (already merged on `feat/touchpoints`). If that code isn't present, add the `customerName` at the call site when wiring.
```
