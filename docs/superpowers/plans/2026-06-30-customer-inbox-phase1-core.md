# Customer Inbox — Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an owned, real-time in-app Inbox where a signed-up customer and the merchant exchange messages in one thread per customer, with a free-email "doorbell" nudging the customer back when a merchant reply is waiting.

**Architecture:** New Supabase tables (`conversations`, `conversation_messages`, `merchant_presence`) under RLS, added to the `supabase_realtime` publication so the browser client streams new messages live. Customer thread at `/inbox`; merchant thread at `/admin/inbox`. Server Actions handle sends (sanitized, rate-limited); a pure doorbell heuristic decides when a merchant reply triggers a notification email (reusing the existing Resend `emailSender`). No AI and no presence-driven bot in this phase — that is Phase 2.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (`@supabase/ssr`), Supabase Realtime (`postgres_changes`), Zod, Vitest, Resend (via `src/lib/touchpoints/channels.ts`).

**Spec:** [docs/superpowers/specs/2026-06-29-customer-inbox-ai-concierge-design.md](../specs/2026-06-29-customer-inbox-ai-concierge-design.md) — this plan covers **§10 Build order item 1 (Inbox core)** only. AI concierge (§5) and touchpoint routing (§7) are later plans.

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.** (CLAUDE.md core rule 1)
- **Server Component by default;** add `"use client"` only for realtime/interactivity. (core rule 4)
- **All Server Action input validated with Zod and sanitized** before any DB write. (security rules)
- **Customer-facing copy lives in `src/content/`**, not inline literals. (core rule 5)
- **Rate-limit every action** via `src/utils/ratelimit.ts` (`checkLimit` + a limiter). (security rules)
- **RLS on every new table;** reuse `public.is_admin()` for admin access. (security rules)
- **Use `logger` / `console.error` for server errors — no `console.log`.** (core rule 7)
- **Migration file naming:** next sequential number is `0014`. Never auto-run in CI; applied via Supabase. (deployment)
- **Service-role client** (`createServiceRoleClient`) only server-side; never passed to a client component. (existing pattern)
- **Browser realtime uses** `createClient` from `@/utils/supabase/client`.
- **Live Supabase project:** `pkkgzsknvkpoowvukrqs`. Apply migrations there via the Supabase MCP `apply_migration`.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0014_inbox.sql` | enums, 3 tables, RLS, realtime publication |
| `src/types/inbox.ts` | shared row + enum types |
| `src/lib/inbox/message.ts` | Zod body schema + `normalizeBody` (pure, tested) |
| `src/lib/inbox/message.test.ts` | unit tests for message validation |
| `src/lib/inbox/store.ts` | I/O adapter: get/create conversation, list/insert messages, mark read, presence |
| `src/lib/inbox/doorbell.ts` | `shouldSendDoorbell` (pure, tested) + `sendDoorbellEmail` |
| `src/lib/inbox/doorbell.test.ts` | unit tests for the doorbell heuristic |
| `src/content/inbox.ts` | customer + admin UI copy |
| `src/app/inbox/page.tsx` | customer thread (RSC shell) |
| `src/app/inbox/actions.ts` | `sendCustomerMessage` action |
| `src/app/inbox/InboxThread.tsx` | `"use client"` — realtime list + composer |
| `src/app/admin/inbox/page.tsx` | merchant: conversation list + selected thread (RSC) |
| `src/app/admin/inbox/actions.ts` | `sendMerchantMessage` + `setPresence` actions |
| `src/app/admin/inbox/AdminThread.tsx` | `"use client"` — realtime list + composer + presence toggle |
| `src/app/admin/page.tsx` | add Inbox tile (modify) |
| `src/components/PublicNav.tsx` | add "Inbox" link for signed-in customers (modify) |

---

## Task 1: Database migration (tables, RLS, realtime)

**Files:**
- Create: `supabase/migrations/0014_inbox.sql`

**Interfaces:**
- Produces: tables `public.conversations`, `public.conversation_messages`, `public.merchant_presence`; enums `conversation_status`, `message_sender`. Columns exactly as the spec §4 data model.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0014_inbox.sql`:

```sql
-- 0014 — Customer inbox: conversations, messages, merchant presence
-- One conversation per customer; messages stream via Supabase Realtime.

-- 1. Enums
do $$ begin
  create type public.conversation_status as enum ('open','awaiting_merchant','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_sender as enum ('customer','bot','merchant');
exception when duplicate_object then null; end $$;

-- 2. Conversations (one per customer)
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles on delete cascade,
  status          public.conversation_status not null default 'open',
  last_message_at timestamptz,
  doorbell_sent_at timestamptz,            -- debounce for the email nudge
  created_at      timestamptz not null default now(),
  unique (customer_id)
);

-- 3. Messages
create table public.conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender          public.message_sender not null,
  body            text not null,
  booking_id      uuid references public.bookings on delete set null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index conversation_messages_conv_idx
  on public.conversation_messages (conversation_id, created_at);

-- 4. Merchant presence (drives bot-vs-human in Phase 2; UI indicator now)
create table public.merchant_presence (
  merchant_id uuid primary key references public.profiles on delete cascade,
  online      boolean not null default false,
  last_seen   timestamptz not null default now()
);

-- 5. RLS
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.merchant_presence enable row level security;

-- Customers see/own only their conversation; admins see all.
create policy "conv_select_own" on public.conversations
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "conv_insert_own" on public.conversations
  for insert with check (customer_id = auth.uid() or public.is_admin());
create policy "conv_update_admin_or_own" on public.conversations
  for update using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

-- Messages: readable/insertable by the conversation's owner or an admin.
-- A customer may only insert sender='customer'; merchant/bot rows come via service role.
create policy "msg_select_member" on public.conversation_messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );
create policy "msg_insert_customer" on public.conversation_messages
  for insert with check (
    sender = 'customer' and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );
create policy "msg_insert_admin" on public.conversation_messages
  for insert with check (public.is_admin());
create policy "msg_update_member" on public.conversation_messages
  for update using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.customer_id = auth.uid()
    )
  );

-- Presence: admin read/write; customers may read (to show "online") .
create policy "presence_select_all_auth" on public.merchant_presence
  for select using (auth.uid() is not null);
create policy "presence_write_admin" on public.merchant_presence
  for all using (public.is_admin()) with check (public.is_admin());

-- 6. Realtime: stream message inserts to subscribed (RLS-authorized) clients.
alter publication supabase_realtime add table public.conversation_messages;
```

- [ ] **Step 2: Apply the migration to the live project**

Apply via the Supabase MCP `apply_migration` (project `pkkgzsknvkpoowvukrqs`, name `0014_inbox`, the SQL above).
Expected: success, no error.

- [ ] **Step 3: Verify the schema landed**

Run the Supabase MCP `list_tables` (schema `public`).
Expected: `conversations`, `conversation_messages`, `merchant_presence` present with the columns above.
Also run via MCP `execute_sql`:
```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'conversation_messages';
```
Expected: one row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0014_inbox.sql
git commit -m "feat(inbox): migration — conversations, messages, presence, RLS, realtime"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/types/inbox.ts`

**Interfaces:**
- Produces: `ConversationStatus`, `MessageSender`, `Conversation`, `ConversationMessage`, `MerchantPresence` types used by every later task.

- [ ] **Step 1: Write the types**

Create `src/types/inbox.ts`:

```ts
// Shared inbox row + enum types. Mirror migration 0014 exactly.

export type ConversationStatus = 'open' | 'awaiting_merchant' | 'closed'
export type MessageSender = 'customer' | 'bot' | 'merchant'

export interface Conversation {
  id: string
  customer_id: string
  status: ConversationStatus
  last_message_at: string | null
  doorbell_sent_at: string | null
  created_at: string
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender: MessageSender
  body: string
  booking_id: string | null
  read_at: string | null
  created_at: string
}

export interface MerchantPresence {
  merchant_id: string
  online: boolean
  last_seen: string
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/inbox.ts
git commit -m "feat(inbox): shared conversation + message types"
```

---

## Task 3: Message validation (pure, tested)

**Files:**
- Create: `src/lib/inbox/message.ts`
- Test: `src/lib/inbox/message.test.ts`

**Interfaces:**
- Consumes: `sanitizeMultiline` from `@/lib/sanitize`.
- Produces: `MAX_MESSAGE_LEN = 2000`; `normalizeBody(input: unknown): string`; `messageBodySchema` (Zod) that yields a non-empty, sanitized string or a validation error.

- [ ] **Step 1: Write the failing test**

Create `src/lib/inbox/message.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeBody, messageBodySchema, MAX_MESSAGE_LEN } from './message'

describe('normalizeBody', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeBody('  hi there  ')).toBe('hi there')
  })

  it('strips angle-bracket tags (sanitizeMultiline)', () => {
    expect(normalizeBody('hello <script>x</script>')).not.toContain('<script>')
  })

  it('caps length at MAX_MESSAGE_LEN', () => {
    expect(normalizeBody('a'.repeat(MAX_MESSAGE_LEN + 50)).length).toBe(MAX_MESSAGE_LEN)
  })
})

describe('messageBodySchema', () => {
  it('rejects empty / whitespace-only input', () => {
    expect(messageBodySchema.safeParse('   ').success).toBe(false)
  })

  it('accepts and returns a normalized body', () => {
    const r = messageBodySchema.safeParse('  hello  ')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('hello')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inbox/message.test.ts`
Expected: FAIL — cannot find module `./message`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inbox/message.ts`:

```ts
import { z } from 'zod'
import { sanitizeMultiline } from '@/lib/sanitize'

export const MAX_MESSAGE_LEN = 2000

/** Trim + sanitize + length-cap a raw message body. Pure. */
export function normalizeBody(input: unknown): string {
  return sanitizeMultiline(input, MAX_MESSAGE_LEN).trim()
}

/** A valid chat message: non-empty after normalization. */
export const messageBodySchema = z
  .unknown()
  .transform(normalizeBody)
  .refine(v => v.length > 0, 'Message cannot be empty.')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inbox/message.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbox/message.ts src/lib/inbox/message.test.ts
git commit -m "feat(inbox): message body validation + sanitization"
```

---

## Task 4: Doorbell heuristic (pure, tested) + email send

**Files:**
- Create: `src/lib/inbox/doorbell.ts`
- Test: `src/lib/inbox/doorbell.test.ts`

**Interfaces:**
- Consumes: `emailSender` from `@/lib/touchpoints/channels`; `TouchpointSender` type from the same module.
- Produces:
  - `DOORBELL_DEBOUNCE_MS = 10 * 60 * 1000`
  - `shouldSendDoorbell(args: { doorbellSentAt: string | null; now: Date }): boolean` — pure.
  - `sendDoorbellEmail(args: { to: string; customerName: string; inboxUrl: string; sender?: TouchpointSender }): Promise<{ ok: boolean; error?: string }>`

Rationale for the heuristic: a merchant reply should nudge the customer, but never more than once per `DOORBELL_DEBOUNCE_MS` per conversation (avoids a burst of replies sending a burst of emails). "Customer is live" optimization is deferred to Phase 2 (needs presence/read tracking); debounce alone is safe and testable now.

- [ ] **Step 1: Write the failing test**

Create `src/lib/inbox/doorbell.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { shouldSendDoorbell, sendDoorbellEmail, DOORBELL_DEBOUNCE_MS } from './doorbell'

const now = new Date('2026-06-30T10:00:00Z')

describe('shouldSendDoorbell', () => {
  it('sends when none was ever sent', () => {
    expect(shouldSendDoorbell({ doorbellSentAt: null, now })).toBe(true)
  })

  it('suppresses inside the debounce window', () => {
    const recent = new Date(now.getTime() - (DOORBELL_DEBOUNCE_MS - 1000)).toISOString()
    expect(shouldSendDoorbell({ doorbellSentAt: recent, now })).toBe(false)
  })

  it('sends again after the debounce window', () => {
    const old = new Date(now.getTime() - (DOORBELL_DEBOUNCE_MS + 1000)).toISOString()
    expect(shouldSendDoorbell({ doorbellSentAt: old, now })).toBe(true)
  })
})

describe('sendDoorbellEmail', () => {
  it('sends via the injected sender and reports ok', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, providerId: 'x' })
    const r = await sendDoorbellEmail({
      to: 'c@example.com',
      customerName: 'Jay',
      inboxUrl: 'https://eagles4x4.ph/inbox',
      sender: { send },
    })
    expect(r.ok).toBe(true)
    expect(send).toHaveBeenCalledOnce()
    const arg = send.mock.calls[0][0]
    expect(arg.to).toBe('c@example.com')
    expect(arg.body).toContain('https://eagles4x4.ph/inbox')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inbox/doorbell.test.ts`
Expected: FAIL — cannot find module `./doorbell`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inbox/doorbell.ts`:

```ts
import { emailSender, type TouchpointSender } from '@/lib/touchpoints/channels'

export const DOORBELL_DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes

/** Pure: have we waited long enough since the last nudge to send another? */
export function shouldSendDoorbell(args: { doorbellSentAt: string | null; now: Date }): boolean {
  if (!args.doorbellSentAt) return true
  const last = new Date(args.doorbellSentAt).getTime()
  return args.now.getTime() - last >= DOORBELL_DEBOUNCE_MS
}

/** Send the "you have a new message" nudge. Sender is injectable for tests. */
export async function sendDoorbellEmail(args: {
  to: string
  customerName: string
  inboxUrl: string
  sender?: TouchpointSender
}): Promise<{ ok: boolean; error?: string }> {
  const sender =
    args.sender ??
    emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    })
  const result = await sender.send({
    to: args.to,
    subject: 'You have a new message from Eagles 4x4',
    body:
      `Hi ${args.customerName}! Our team replied to you. ` +
      `Open your inbox to read and reply: ${args.inboxUrl}`,
  })
  return { ok: result.ok, error: result.error }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inbox/doorbell.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbox/doorbell.ts src/lib/inbox/doorbell.test.ts
git commit -m "feat(inbox): doorbell debounce heuristic + nudge email"
```

---

## Task 5: Inbox store (I/O adapter)

**Files:**
- Create: `src/lib/inbox/store.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (`@supabase/supabase-js`); types from `@/types/inbox`.
- Produces: `createInboxStore(client: SupabaseClient)` returning:
  - `getOrCreateConversation(customerId: string): Promise<Conversation>`
  - `listMessages(conversationId: string): Promise<ConversationMessage[]>`
  - `insertMessage(input: { conversationId: string; sender: MessageSender; body: string; bookingId?: string | null }): Promise<ConversationMessage>`
  - `markRead(conversationId: string, reader: MessageSender): Promise<void>`
  - `markDoorbellSent(conversationId: string): Promise<void>`
  - `listConversations(): Promise<(Conversation & { customer_name: string | null })[]>` (admin)

Note: I/O adapter, mirrors `src/lib/touchpoints/store.ts` — not unit-tested (the pure logic it relies on is tested in Tasks 3–4). Verified at runtime in Tasks 6–7.

- [ ] **Step 1: Write the store**

Create `src/lib/inbox/store.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Conversation, ConversationMessage, MessageSender } from '@/types/inbox'

export function createInboxStore(client: SupabaseClient) {
  return {
    async getOrCreateConversation(customerId: string): Promise<Conversation> {
      const existing = await client
        .from('conversations')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle()
      if (existing.error) throw new Error(`getOrCreateConversation: ${existing.error.message}`)
      if (existing.data) return existing.data as Conversation

      const created = await client
        .from('conversations')
        .insert({ customer_id: customerId })
        .select('*')
        .single()
      if (created.error) throw new Error(`getOrCreateConversation insert: ${created.error.message}`)
      return created.data as Conversation
    },

    async listMessages(conversationId: string): Promise<ConversationMessage[]> {
      const { data, error } = await client
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(`listMessages: ${error.message}`)
      return (data ?? []) as ConversationMessage[]
    },

    async insertMessage(input: {
      conversationId: string
      sender: MessageSender
      body: string
      bookingId?: string | null
    }): Promise<ConversationMessage> {
      const { data, error } = await client
        .from('conversation_messages')
        .insert({
          conversation_id: input.conversationId,
          sender: input.sender,
          body: input.body,
          booking_id: input.bookingId ?? null,
        })
        .select('*')
        .single()
      if (error) throw new Error(`insertMessage: ${error.message}`)

      const touch = await client
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          // A customer message means the merchant must act; flag it.
          ...(input.sender === 'customer' ? { status: 'awaiting_merchant' } : {}),
        })
        .eq('id', input.conversationId)
      if (touch.error) throw new Error(`insertMessage touch: ${touch.error.message}`)

      return data as ConversationMessage
    },

    async markRead(conversationId: string, reader: MessageSender): Promise<void> {
      // Mark the *other* party's messages as read.
      const senders: MessageSender[] =
        reader === 'merchant' ? ['customer'] : ['merchant', 'bot']
      const { error } = await client
        .from('conversation_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .is('read_at', null)
        .in('sender', senders)
      if (error) throw new Error(`markRead: ${error.message}`)
    },

    async markDoorbellSent(conversationId: string): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ doorbell_sent_at: new Date().toISOString() })
        .eq('id', conversationId)
      if (error) throw new Error(`markDoorbellSent: ${error.message}`)
    },

    async listConversations(): Promise<(Conversation & { customer_name: string | null })[]> {
      const { data, error } = await client
        .from('conversations')
        .select('*, customer:profiles!customer_id ( full_name )')
        .order('last_message_at', { ascending: false, nullsFirst: false })
      if (error) throw new Error(`listConversations: ${error.message}`)
      return (data ?? []).map((row: Conversation & { customer: { full_name: string | null } | null }) => ({
        ...row,
        customer_name: row.customer?.full_name ?? null,
      }))
    },
  }
}

export type InboxStore = ReturnType<typeof createInboxStore>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inbox/store.ts
git commit -m "feat(inbox): supabase-backed conversation store"
```

---

## Task 6: Customer inbox — copy, action, page, realtime thread

**Files:**
- Create: `src/content/inbox.ts`
- Create: `src/app/inbox/actions.ts`
- Create: `src/app/inbox/page.tsx`
- Create: `src/app/inbox/InboxThread.tsx`
- Modify: `src/components/PublicNav.tsx` (add Inbox link for signed-in users)

**Interfaces:**
- Consumes: `requireConfirmed` (`@/lib/auth`), `createClient` server + browser, `createInboxStore`, `messageBodySchema`, `rlServerAction` + `checkLimit`.
- Produces: `sendCustomerMessage(formData: FormData): Promise<{ error?: string }>`; `<InboxThread conversationId initial customerView />` client component.

- [ ] **Step 1: Write the copy**

Create `src/content/inbox.ts`:

```ts
export const inboxCopy = {
  title: 'Your Inbox',
  subtitle: 'Chat with Eagles 4x4 — booking updates, questions, anytime.',
  empty: 'No messages yet. Send us a question and we’ll get back to you.',
  placeholder: 'Type a message…',
  send: 'Send',
  signupInvite: 'Create an account to chat with us and track your bookings.',
  admin: {
    title: 'Customer Inbox',
    listEmpty: 'No conversations yet.',
    online: 'You are online',
    offline: 'You are offline',
  },
} as const
```

- [ ] **Step 2: Write the customer send action**

Create `src/app/inbox/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function sendCustomerMessage(formData: FormData): Promise<{ error?: string }> {
  const user = await requireConfirmed()
  const limit = await checkLimit(rlServerAction, `inbox-send:${user.id}:${await getIp()}`)
  if (!limit.allowed) return { error: 'Too many messages. Please slow down.' }

  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const supabase = await createClient()
  const store = createInboxStore(supabase)
  try {
    const convo = await store.getOrCreateConversation(user.id)
    await store.insertMessage({ conversationId: convo.id, sender: 'customer', body: parsed.data })
  } catch (err) {
    console.error('[sendCustomerMessage]', err)
    return { error: 'Could not send your message. Please try again.' }
  }
  revalidatePath('/inbox')
  return {}
}
```

- [ ] **Step 3: Write the realtime thread client component**

Create `src/app/inbox/InboxThread.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { ConversationMessage } from '@/types/inbox'
import { inboxCopy } from '@/content/inbox'
import { sendCustomerMessage } from '@/app/inbox/actions'

interface Props {
  conversationId: string
  initial: ConversationMessage[]
  isAdmin?: boolean
  onSend?: (formData: FormData) => Promise<{ error?: string }>
}

export function InboxThread({ conversationId, initial, isAdmin = false, onSend }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const send = onSend ?? sendCustomerMessage
  const selfSender = isAdmin ? 'merchant' : 'customer'

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`inbox:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          const row = payload.new as ConversationMessage
          setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]))
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await send(formData)
      if (res.error) setError(res.error)
      else formRef.current?.reset()
    })
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <li className="text-text-secondary">{inboxCopy.empty}</li>}
        {messages.map(m => {
          const mine = m.sender === selfSender
          return (
            <li key={m.id} className={mine ? 'text-right' : 'text-left'}>
              <span
                className={[
                  'inline-block max-w-[80%] rounded-2xl px-4 py-2',
                  mine ? 'bg-accent text-white' : 'bg-surface text-text-primary',
                ].join(' ')}
              >
                {m.body}
              </span>
            </li>
          )
        })}
        <div ref={bottomRef} />
      </ul>

      <form ref={formRef} action={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label htmlFor="inbox-body" className="sr-only">
          {inboxCopy.placeholder}
        </label>
        <input
          id="inbox-body"
          name="body"
          autoComplete="off"
          placeholder={inboxCopy.placeholder}
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-text-primary"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-50"
        >
          {inboxCopy.send}
        </button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write the customer page (RSC)**

Create `src/app/inbox/page.tsx`:

```tsx
import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { inboxCopy } from '@/content/inbox'
import { InboxThread } from './InboxThread'

export default async function InboxPage() {
  const user = await requireConfirmed()
  const supabase = await createClient()
  const store = createInboxStore(supabase)
  const convo = await store.getOrCreateConversation(user.id)
  const messages = await store.listMessages(convo.id)
  await store.markRead(convo.id, 'customer')

  return (
    <main className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col px-4 py-8">
      <header className="mb-4">
        <h1 className="font-display text-2xl leading-[1.15] text-text-primary">{inboxCopy.title}</h1>
        <p className="text-text-secondary">{inboxCopy.subtitle}</p>
      </header>
      <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-bg">
        <InboxThread conversationId={convo.id} initial={messages} />
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Add the customer nav link**

In `src/components/PublicNav.tsx`, add an "Inbox" link visible to signed-in users. Match the existing link rendering (find how the component receives/derives auth state — follow the pattern already used for other signed-in-only links such as `/bookings`; if none exists, add an `Inbox` link next to the `/bookings` link). Use `href="/inbox"` and label `Inbox`. Keep keyboard focus + aria conventions already in the file.

- [ ] **Step 6: Verify build + types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 7: Manual runtime verification**

With dev server running and signed in as a customer:
1. Visit `/inbox` → page loads, empty state shows.
2. Send a message → it appears immediately; row exists in `conversation_messages` (verify via Supabase MCP `execute_sql`).
3. Open a second browser/tab on `/inbox` as the same user → insert a row via MCP `execute_sql` (sender `merchant`) → it appears live without refresh (confirms realtime + RLS).

- [ ] **Step 8: Commit**

```bash
git add src/content/inbox.ts src/app/inbox/ src/components/PublicNav.tsx
git commit -m "feat(inbox): customer thread page, send action, realtime UI"
```

---

## Task 7: Admin inbox — actions (with doorbell), page, thread, presence, hub tile

**Files:**
- Create: `src/app/admin/inbox/actions.ts`
- Create: `src/app/admin/inbox/page.tsx`
- Create: `src/app/admin/inbox/AdminThread.tsx`
- Modify: `src/app/admin/page.tsx` (add Inbox tile)

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/auth`), `createClient` + `createServiceRoleClient`, `createInboxStore`, `messageBodySchema`, `shouldSendDoorbell` + `sendDoorbellEmail`, `rlAdminGeneral` + `checkLimit`, `inboxCopy`, `InboxThread`.
- Produces: `sendMerchantMessage(formData)`, `setPresence(formData)` actions.

- [ ] **Step 1: Write the admin actions (send + doorbell + presence)**

Create `src/app/admin/inbox/actions.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { shouldSendDoorbell, sendDoorbellEmail } from '@/lib/inbox/doorbell'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const idSchema = z.string().uuid()

export async function sendMerchantMessage(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const limit = await checkLimit(rlAdminGeneral, `inbox-admin-send:${user.id}:${await getIp()}`)
  if (!limit.allowed) return { error: 'Too many actions. Please slow down.' }

  const conversationId = idSchema.safeParse(formData.get('conversationId'))
  if (!conversationId.success) return { error: 'Invalid conversation.' }
  const parsed = messageBodySchema.safeParse(formData.get('body'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid message' }

  const supabase = await createClient()
  const store = createInboxStore(supabase)
  try {
    await store.insertMessage({
      conversationId: conversationId.data,
      sender: 'merchant',
      body: parsed.data,
    })
    await store.markRead(conversationId.data, 'merchant')
    await maybeRingDoorbell(conversationId.data)
  } catch (err) {
    console.error('[sendMerchantMessage]', err)
    return { error: 'Could not send the message.' }
  }
  revalidatePath('/admin/inbox')
  return {}
}

// Service-role: read the customer's email + doorbell state, decide, send, stamp.
async function maybeRingDoorbell(conversationId: string): Promise<void> {
  const admin = createServiceRoleClient()
  const { data, error } = await admin
    .from('conversations')
    .select('id, doorbell_sent_at, customer:profiles!customer_id ( email, full_name )')
    .eq('id', conversationId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('[maybeRingDoorbell] load', error)
    return
  }
  const customer = data.customer as { email: string | null; full_name: string | null } | null
  if (!customer?.email) return
  if (!shouldSendDoorbell({ doorbellSentAt: data.doorbell_sent_at, now: new Date() })) return

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const res = await sendDoorbellEmail({
    to: customer.email,
    customerName: customer.full_name ?? 'there',
    inboxUrl: `${base}/inbox`,
  })
  if (!res.ok) {
    console.error('[maybeRingDoorbell] send', res.error)
    return
  }
  const store = createInboxStore(admin)
  await store.markDoorbellSent(conversationId)
}

export async function setPresence(formData: FormData): Promise<{ error?: string }> {
  const { user } = await requireAdmin()
  const online = formData.get('online') === 'true'
  const supabase = await createClient()
  const { error } = await supabase
    .from('merchant_presence')
    .upsert({ merchant_id: user.id, online, last_seen: new Date().toISOString() })
  if (error) {
    console.error('[setPresence]', error)
    return { error: 'Could not update presence.' }
  }
  revalidatePath('/admin/inbox')
  return {}
}
```

> Note: `profiles` must expose `email`. If it does not, replace the select with a join through `bookings.contact_email` or read the email from `auth.users` via the service-role admin API. Verify the column during Step 5.

- [ ] **Step 2: Write the admin thread client component**

Create `src/app/admin/inbox/AdminThread.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import type { ConversationMessage } from '@/types/inbox'
import { InboxThread } from '@/app/inbox/InboxThread'
import { inboxCopy } from '@/content/inbox'
import { sendMerchantMessage, setPresence } from './actions'

interface Props {
  conversationId: string
  initial: ConversationMessage[]
  online: boolean
}

export function AdminThread({ conversationId, initial, online }: Props) {
  const [pending, startTransition] = useTransition()

  function togglePresence() {
    const fd = new FormData()
    fd.set('online', online ? 'false' : 'true')
    startTransition(() => {
      void setPresence(fd)
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-2">
        <button
          type="button"
          onClick={togglePresence}
          disabled={pending}
          aria-pressed={online}
          className="rounded-lg border border-border px-3 py-1 text-sm text-text-primary disabled:opacity-50"
        >
          {online ? inboxCopy.admin.online : inboxCopy.admin.offline}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxThread
          conversationId={conversationId}
          initial={initial}
          isAdmin
          onSend={sendMerchantMessage}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the admin page (list + selected thread)**

Create `src/app/admin/inbox/page.tsx`:

```tsx
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { inboxCopy } from '@/content/inbox'
import { AdminThread } from './AdminThread'

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { user } = await requireAdmin()
  const { c } = await searchParams
  const supabase = await createClient()
  const store = createInboxStore(supabase)
  const conversations = await store.listConversations()

  const selected = c ?? conversations[0]?.id ?? null
  const messages = selected ? await store.listMessages(selected) : []
  if (selected) await store.markRead(selected, 'merchant')

  const { data: presence } = await supabase
    .from('merchant_presence')
    .select('online')
    .eq('merchant_id', user.id)
    .maybeSingle()

  return (
    <main className="mx-auto flex h-[calc(100vh-6rem)] max-w-6xl gap-4 px-4 py-6">
      <aside className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-border">
        <h1 className="border-b border-border p-3 font-display text-lg text-text-primary">
          {inboxCopy.admin.title}
        </h1>
        {conversations.length === 0 && (
          <p className="p-3 text-text-secondary">{inboxCopy.admin.listEmpty}</p>
        )}
        <ul>
          {conversations.map(conv => (
            <li key={conv.id}>
              <Link
                href={`/admin/inbox?c=${conv.id}`}
                className={[
                  'block border-b border-border px-3 py-2 text-text-primary hover:bg-surface',
                  conv.id === selected ? 'bg-surface' : '',
                ].join(' ')}
              >
                <span className="font-medium">{conv.customer_name ?? 'Customer'}</span>
                {conv.status === 'awaiting_merchant' && (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                    new
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex-1 overflow-hidden rounded-2xl border border-border">
        {selected ? (
          <AdminThread
            conversationId={selected}
            initial={messages}
            online={presence?.online ?? false}
          />
        ) : (
          <p className="p-4 text-text-secondary">{inboxCopy.admin.listEmpty}</p>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Add the admin hub tile**

In `src/app/admin/page.tsx`, add a tile (mirror the existing `Tile` usage — `href`, `title`, `desc`, `ready`):

```tsx
<Tile
  href="/admin/inbox"
  title="Inbox"
  desc="Live chat with customers"
  ready
/>
```

Place it among the active tiles (not the `comingSoon` group).

- [ ] **Step 5: Verify build + types + lint, and confirm the email column**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.
Then confirm `profiles.email` exists via Supabase MCP `execute_sql`:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name='email';
```
If it returns no row, update `maybeRingDoorbell` per the Step 1 note (read email via the service-role auth admin API) before continuing.

- [ ] **Step 6: Manual end-to-end verification**

1. Sign in as the customer in Browser A on `/inbox`; sign in as admin in Browser B on `/admin/inbox`.
2. Customer sends a message → it appears in the admin conversation list with a "new" badge and live in the admin thread.
3. Admin replies → appears live in the customer thread (realtime).
4. With customer tab closed, admin replies again → a doorbell email arrives (check the configured inbox); a second immediate reply does **not** send another email (debounce). Verify `doorbell_sent_at` is set via MCP `execute_sql`.
5. Toggle presence → `merchant_presence.online` flips (verify via MCP).

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/inbox/ src/app/admin/page.tsx
git commit -m "feat(inbox): admin inbox, merchant replies, doorbell, presence"
```

---

## Task 8: Phase-1 regression sweep

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all green, including the new `message.test.ts` (5) and `doorbell.test.ts` (4).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compiles clean. (Note the known disk-space constraint — if the build cannot run locally, record that and rely on the Vercel preview build instead.)

- [ ] **Step 3: Update docs**

Append a short "Customer Inbox (Phase 1)" entry to `CONTEXT.md` describing the new routes (`/inbox`, `/admin/inbox`), tables, and that AI + touchpoint routing are Phase 2/3. Commit:

```bash
git add CONTEXT.md
git commit -m "docs(inbox): record Phase 1 inbox in CONTEXT"
```

---

## Self-Review

**Spec coverage (§ from the spec):**
- §3 one thread per customer, Realtime — Tasks 1, 5, 6, 7 ✓
- §4 data model (3 tables, enums, RLS) — Task 1 ✓
- §6 doorbell (in-app unread + free email) — Tasks 4, 7 ✓; **browser push deferred** (see below)
- §7 guest fallback — unchanged; guests have no account so never reach `/inbox` (gated by `requireConfirmed`) ✓
- §8 security (RLS, sanitize, rate-limit, service-role) — Tasks 1, 3, 6, 7 ✓
- §5 AI concierge, §7 touchpoint routing → **out of scope** (Phase 2 / Phase 3) by design.

**Deferred from §6 — browser push:** Web push needs a new dependency (`web-push`), a service worker, and VAPID keys — a distinct concern from the chat core. It is intentionally left to a follow-up plan so Phase 1 stays shippable. In-app unread (`status`/`read_at`) + the email doorbell deliver the reach for Phase 1. Flag the dependency to the user when that plan is written.

**Placeholder scan:** none — every code step contains complete code; the one conditional (`profiles.email`) has an explicit verification step and fallback.

**Type consistency:** `createInboxStore` method names (`getOrCreateConversation`, `listMessages`, `insertMessage`, `markRead`, `markDoorbellSent`, `listConversations`) are used identically in Tasks 5–7. `shouldSendDoorbell`/`sendDoorbellEmail` signatures match between Task 4 and Task 7. `InboxThread` props (`conversationId`, `initial`, `isAdmin`, `onSend`) match between Tasks 6 and 7. `messageBodySchema` consumed consistently.
