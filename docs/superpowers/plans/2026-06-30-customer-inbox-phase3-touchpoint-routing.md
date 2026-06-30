# Customer Inbox — Phase 3 (Touchpoint Routing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the daily touchpoints (appointment reminder / post-service / PMS) **into the inbox** for account-holders — as a bot message plus a doorbell nudge they can reply to — closing the two-way loop. Guests keep the existing one-way email path; guests with no email keep the manual click-to-chat queue.

**Architecture:** Add an `inbox` value to the `touchpoint_channel` enum. `resolveChannel` returns `inbox` when the due booking has a `customer_id` (an account-holder), `email` when there's a usable address, else `chat`. The engine gains an inbox branch that renders the existing template body and calls a new `store.deliverToInbox`, which (service-role) gets/creates the customer's conversation, posts a `sender='bot'` message, and rings the Phase-1 doorbell (respecting email opt-out and the debounce). Everything runs inside the already-deployed daily cron — no new entry point.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest. Reuses Phase 1 `createInboxStore` + `doorbell.ts`.

**Spec:** [docs/superpowers/specs/2026-06-29-customer-inbox-ai-concierge-design.md](../specs/2026-06-29-customer-inbox-ai-concierge-design.md) §7. Builds on Phase 1 (inbox core) and the existing Touchpoints engine (`src/lib/touchpoints/`).

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.**
- **`deliverToInbox` returns `boolean`, never throws** — on failure the engine leaves the touchpoint `pending` so the next cron run retries (mirrors the email-send contract). Log failures with `console.error`.
- **Bot writes via the service-role client** the cron already passes to `createTouchpointStore`.
- **Respect email opt-out for the doorbell only** — the in-app message always posts; the doorbell *email* is skipped when the address is suppressed (`notifyByEmail: !suppressed`).
- **Reuse, don't duplicate:** inbox delivery uses `createInboxStore` (Phase 1) and `shouldSendDoorbell`/`sendDoorbellEmail` (Phase 1) — no new chat/doorbell logic.
- **Migration naming:** next sequential number is `0015`. Apply to live project `pkkgzsknvkpoowvukrqs` via the Supabase MCP.
- **No new env vars** (`NEXT_PUBLIC_SITE_URL` + `RESEND_API_KEY`/`TOUCHPOINT_EMAIL_FROM` already used by the doorbell).

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/0015_touchpoint_inbox_channel.sql` | Create — add `inbox` to `touchpoint_channel` enum |
| `src/types/touchpoints.ts` | Modify — `TouchpointChannel` gains `'inbox'` |
| `src/lib/touchpoints/engine.ts` | Modify — `resolveChannel`, `TouchpointStore.deliverToInbox`, `TouchpointSummary.inboxed`, inbox branch |
| `src/lib/touchpoints/engine.test.ts` | Modify — inbox routing tests + stub `deliverToInbox` in existing fakes |
| `src/lib/touchpoints/store.ts` | Modify — implement `deliverToInbox` |

---

## Task 1: Add the `inbox` channel (enum + type)

**Files:**
- Create: `supabase/migrations/0015_touchpoint_inbox_channel.sql`
- Modify: `src/types/touchpoints.ts`

**Interfaces:**
- Produces: `touchpoint_channel` enum value `inbox`; TS `TouchpointChannel = 'email' | 'chat' | 'inbox'`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0015_touchpoint_inbox_channel.sql`:

```sql
-- 0015 — Touchpoints can be delivered into the customer inbox (Phase 3).
-- Account-holders get reminders/follow-ups as an in-app bot message they can
-- reply to; guests keep the email / manual-chat paths.
alter type public.touchpoint_channel add value if not exists 'inbox';
```

- [ ] **Step 2: Apply to the live project**

Apply via the Supabase MCP `apply_migration` (project `pkkgzsknvkpoowvukrqs`, name `0015_touchpoint_inbox_channel`, the SQL above).
Expected: success.

- [ ] **Step 3: Verify the enum value landed**

Supabase MCP `execute_sql`:
```sql
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'touchpoint_channel' order by enumsortorder;
```
Expected: rows include `email`, `chat`, `inbox`.

- [ ] **Step 4: Update the TypeScript type**

In `src/types/touchpoints.ts`, change:

```ts
export type TouchpointChannel = 'email' | 'chat' | 'inbox'
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (note: the engine's `resolveChannel`/store may now be non-exhaustive — that's fixed in Tasks 2–3; if errors appear they should only be in `engine.ts`/`store.ts`, addressed next).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0015_touchpoint_inbox_channel.sql src/types/touchpoints.ts
git commit -m "feat(touchpoints): add inbox delivery channel (enum + type)"
```

---

## Task 2: Engine — route account-holders to the inbox (TDD)

**Files:**
- Modify: `src/lib/touchpoints/engine.ts`
- Modify: `src/lib/touchpoints/engine.test.ts`

**Interfaces:**
- Consumes: `DueBooking` (now with `customer_id`), `buildTokens`/`renderTemplate`.
- Produces:
  - `resolveChannel(b, emailSuppressed)` → `'inbox'` when `b.customer_id` is set.
  - `TouchpointStore.deliverToInbox(args: { customerId: string; body: string; customerName: string; customerEmail: string | null; notifyByEmail: boolean }): Promise<boolean>`
  - `TouchpointSummary.inboxed: number`

- [ ] **Step 1: Update the tests (red)**

In `src/lib/touchpoints/engine.test.ts`:

(a) Add inbox cases to the `resolveChannel` describe block:

```ts
  it('inbox when the booking has a customer account', () => {
    expect(resolveChannel(booking({ customer_id: 'cust-1', contact_email: 'a@b.com' }), false)).toBe('inbox')
  })
  it('inbox takes priority even if email is suppressed', () => {
    expect(resolveChannel(booking({ customer_id: 'cust-1', contact_email: 'a@b.com' }), true)).toBe('inbox')
  })
```

(b) Add a stub `deliverToInbox` to **both** existing fake stores (so they still satisfy `TouchpointStore`). Add this method to each `store` object literal:

```ts
      async deliverToInbox() { return true },
```

(c) Add a new test in the `runTouchpointEngine` describe block:

```ts
  it('delivers to the inbox for account-holders and counts them', async () => {
    const delivered: string[] = []
    const sent: string[] = []
    const store = {
      async findDueBookings(type: string) {
        return type === 'post_service'
          ? [booking({ id: 'b3', customer_id: 'cust-9', contact_email: 'acct@mail.com', completed_at: '2026-06-14' })]
          : []
      },
      async getTemplate() { return { subject: null, body: 'Hi {{customer_name}}, how is your {{vehicle}}?' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent(row: { booking_id: string; type: string; channel: string; status: string }) {
        return { id: row.booking_id + ':' + row.type }
      },
      async markSent(id: string) { sent.push(id) },
      async deliverToInbox(args: { customerId: string; body: string }) {
        delivered.push(`${args.customerId}|${args.body}`)
        return true
      },
    }
    const sender = { async send() { return { ok: true } } }
    const summary = await runTouchpointEngine({ today: '2026-06-17', shopName: 'Eagles 4x4', store, emailSender: sender })

    expect(summary.inboxed).toBe(1)
    expect(summary.emailed).toBe(0)
    expect(delivered).toEqual(['cust-9|Hi Juan, how is your Hilux?'])
    expect(sent).toEqual(['b3:post_service'])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: FAIL — `resolveChannel` doesn't return `inbox`; `summary.inboxed` undefined.

- [ ] **Step 3: Update the engine**

In `src/lib/touchpoints/engine.ts`:

(a) Add the delivery method to the `TouchpointStore` interface (after `markSent`):

```ts
  /** Post a touchpoint into the customer's inbox; returns false on failure (retried next run). */
  deliverToInbox(args: {
    customerId: string
    body: string
    customerName: string
    customerEmail: string | null
    notifyByEmail: boolean
  }): Promise<boolean>
```

(b) Replace `resolveChannel`:

```ts
/**
 * Account-holders get the touchpoint in their inbox (two-way). Guests get email
 * when we have an un-suppressed address; otherwise the manual chat queue.
 */
export function resolveChannel(b: DueBooking, emailSuppressed: boolean): TouchpointChannel {
  if (b.customer_id) return 'inbox'
  if (b.contact_email && !emailSuppressed) return 'email'
  return 'chat'
}
```

(c) Add `inboxed` to the summary type and initializer:

```ts
export interface TouchpointSummary {
  created: number
  emailed: number
  queued: number
  inboxed: number
}
```
```ts
  const summary: TouchpointSummary = { created: 0, emailed: 0, queued: 0, inboxed: 0 }
```

(d) Replace the delivery `if/else` (the block starting `if (channel === 'email' && b.contact_email)`):

```ts
      if (channel === 'inbox' && b.customer_id) {
        const tokens = buildTokens(b, shopName)
        const body = renderTemplate(template.body, tokens)
        const ok = await store.deliverToInbox({
          customerId: b.customer_id,
          body,
          customerName: b.customer_name,
          customerEmail: b.contact_email,
          notifyByEmail: !suppressed,
        })
        if (ok) {
          await store.markSent(inserted.id)
          summary.inboxed++
        }
      } else if (channel === 'email' && b.contact_email) {
        const tokens = buildTokens(b, shopName)
        const subject = template.subject ? renderTemplate(template.subject, tokens) : undefined
        const body = renderTemplate(template.body, tokens)

        const result = await emailSender.send({ to: b.contact_email, subject, body })
        if (result.ok) {
          await store.markSent(inserted.id)
          summary.emailed++
        }
      } else {
        // chat is sent manually by staff via click-to-chat; just leave it pending
        summary.queued++
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: PASS (resolveChannel: 5; runTouchpointEngine: 3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/engine.ts src/lib/touchpoints/engine.test.ts
git commit -m "feat(touchpoints): route account-holders to the inbox"
```

---

## Task 3: Store — implement `deliverToInbox`

**Files:**
- Modify: `src/lib/touchpoints/store.ts`

**Interfaces:**
- Consumes: `createInboxStore` (`@/lib/inbox/store`), `shouldSendDoorbell` + `sendDoorbellEmail` (`@/lib/inbox/doorbell`).
- Produces: `deliverToInbox` on the object returned by `createTouchpointStore`, matching the Task 2 interface.

Note: I/O adapter (not unit-tested, per the existing store precedent). Verified at runtime in Task 4. `createTouchpointStore` already receives the service-role client, so conversation create + bot insert bypass RLS.

- [ ] **Step 1: Add imports**

At the top of `src/lib/touchpoints/store.ts`, add:

```ts
import { createInboxStore } from '@/lib/inbox/store'
import { shouldSendDoorbell, sendDoorbellEmail } from '@/lib/inbox/doorbell'
```

- [ ] **Step 2: Implement the method**

Inside the object returned by `createTouchpointStore` (after `markSent`), add:

```ts
    async deliverToInbox(args: {
      customerId: string
      body: string
      customerName: string
      customerEmail: string | null
      notifyByEmail: boolean
    }): Promise<boolean> {
      try {
        const inbox = createInboxStore(client)
        const convo = await inbox.getOrCreateConversation(args.customerId)
        await inbox.insertMessage({ conversationId: convo.id, sender: 'bot', body: args.body })

        // Doorbell the customer back in — debounced, email skipped if opted out.
        if (
          args.notifyByEmail &&
          args.customerEmail &&
          shouldSendDoorbell({ doorbellSentAt: convo.doorbell_sent_at, now: new Date() })
        ) {
          const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
          const res = await sendDoorbellEmail({
            to: args.customerEmail,
            customerName: args.customerName,
            inboxUrl: `${base}/inbox`,
          })
          if (res.ok) await inbox.markDoorbellSent(convo.id)
        }
        return true
      } catch (err) {
        console.error('[deliverToInbox]', err)
        return false
      }
    },
```

- [ ] **Step 3: Verify build + types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/touchpoints/store.ts
git commit -m "feat(touchpoints): deliver touchpoints into the inbox with doorbell"
```

---

## Task 4: Verification + regression

**Files:** none (verification only).

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all green (engine tests updated; no regressions).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. (If the build hits the disk constraint, record it and rely on the Vercel preview build.)

- [ ] **Step 3: Manual runtime verification**

With the migration applied and a signed-in customer who has a **completed booking dated 3 days before "today"** (so a `post_service` touchpoint is due):
1. Trigger the cron: `GET /api/cron/touchpoints` with the `CRON_SECRET` bearer.
2. Confirm a `touchpoints` row was created with `channel = 'inbox'` and `status = 'sent'` (Supabase MCP `execute_sql`).
3. Confirm a `sender='bot'` message appears in that customer's `/inbox` thread (live if they're viewing it).
4. Confirm a doorbell email was sent (and that a second due touchpoint within 10 minutes does **not** send a second doorbell — debounce).
5. **Guest regression:** a due touchpoint for a booking with `customer_id = NULL` + an email still sends an **email** (channel `email`), not inbox.
6. The customer replies in the thread → it flips to `awaiting_merchant` (Phase 1 behavior) and, if no merchant is online, the Phase 2 concierge answers. (End-to-end two-way loop.)

---

## Self-Review

**Spec coverage (§7):**
- Account-holders: post-service / reminder / PMS land in the inbox + doorbell, repliable — Tasks 1–3 ✓
- Guests keep the one-way email path; no-email guests keep the manual chat queue — `resolveChannel` (Task 2) ✓
- Two-way loop closes (reply → `awaiting_merchant` → concierge/human) — inherited from Phases 1–2; verified in Task 4 Step 3.6 ✓

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `deliverToInbox`'s signature is identical in the interface (Task 2), the test fakes (Task 2), and the implementation (Task 3). `TouchpointChannel` gains `inbox` in Task 1 before `resolveChannel` returns it in Task 2. `TouchpointSummary.inboxed` is added with its initializer in the same step it's incremented.

**Reuse:** inbox delivery and the doorbell are the Phase 1 primitives (`createInboxStore`, `shouldSendDoorbell`, `sendDoorbellEmail`) — no duplicated logic. The inbox message reuses the existing email template body (no new template rows).

**Deferred:** per-customer inbox-vs-email preference (always inbox for account-holders for now); marking the bot's outbound touchpoint as `awaiting_merchant` (left `open` — a proactive nudge isn't yet waiting on the merchant; the customer's reply flips it).
```
