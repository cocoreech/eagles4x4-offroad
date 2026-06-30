# Customer Inbox — Phase 2 (AI Concierge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a signed-up customer sends an inbox message and no merchant is online, an AI concierge auto-replies — grounded in the live catalog, an app FAQ, and the customer's own bookings — answering catalog/app questions and handing off anything complex to a human.

**Architecture:** The existing `sendCustomerMessage` action gains a post-insert step. If no merchant is online, it assembles a grounding system prompt (services + products + app FAQ + the customer's bookings), calls Claude via raw `fetch` to `POST /v1/messages` (mirroring the Resend/PayMongo adapters), and writes the reply as a `sender='bot'` message through the service-role client. The model returns structured `{reply, needs_human}`; on `needs_human` the conversation is flagged `awaiting_merchant` so it surfaces in the admin queue. Spend is capped by the existing `checkAiBudget`/`recordAiUsage`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Zod, Vitest, Claude Messages API (`claude-haiku-4-5`) via raw `fetch`.

**Spec:** [docs/superpowers/specs/2026-06-29-customer-inbox-ai-concierge-design.md](../specs/2026-06-29-customer-inbox-ai-concierge-design.md) §5 (AI concierge). Builds on Phase 1 (inbox core, branch `feat/customer-inbox`).

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.**
- **Raw `fetch` for the Claude call** — no `@anthropic-ai/sdk` dependency. Mirror `emailSender` in `src/lib/touchpoints/channels.ts` (raw REST, injectable `fetchImpl` for tests).
- **Model:** `claude-haiku-4-5`. **No `thinking` and no `effort` params** (effort 400s on Haiku; thinking is unneeded for grounded Q&A).
- **API headers:** `x-api-key: <ANTHROPIC_API_KEY>`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
- **Structured output:** request `output_config.format` = a `json_schema` with `additionalProperties: false` + `required`; parse `response.content[0].text` as JSON.
- **Sanitize all customer-supplied text with `sanitizeForPrompt`** (`@/lib/sanitize`) before it enters the prompt.
- **Cap spend** with `checkAiBudget('customer', customerId)` before the call and `recordAiUsage('customer', customerId, costUsd)` after.
- **Bot writes via the service-role client** (`createServiceRoleClient`) only; never pass it to a client component.
- **No `console.log`** — `console.error` for failures. The concierge must **never throw into the user's send path**: a bot failure leaves the customer message in place (status stays `awaiting_merchant`) so a human picks it up.
- **Pricing (Haiku 4.5):** input $1.00 / output $5.00 per 1M tokens → `costUsd = usage.input_tokens/1e6 * 1 + usage.output_tokens/1e6 * 5`.
- **New env var:** `ANTHROPIC_API_KEY`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/content/app-faq.ts` | Curated app FAQ text (hours, location, how booking works, guest vs account) |
| `src/lib/inbox/grounding.ts` | Fetch catalog + customer bookings; `buildConciergeSystemPrompt` (pure) |
| `src/lib/inbox/grounding.test.ts` | Unit tests for `buildConciergeSystemPrompt` |
| `src/lib/inbox/concierge.ts` | Raw-fetch Claude caller + cost calc; `generateConciergeReply` |
| `src/lib/inbox/concierge.test.ts` | Unit tests (injected fetch): request shape, parsing, cost, error handling |
| `src/lib/inbox/store.ts` | Add `isAnyMerchantOnline()` + `setStatus()` (modify) |
| `src/app/inbox/actions.ts` | Wire `maybeRunConcierge` into `sendCustomerMessage` (modify) |

---

## Task 1: App FAQ content + grounding prompt builder (pure, tested)

**Files:**
- Create: `src/content/app-faq.ts`
- Create: `src/lib/inbox/grounding.ts`
- Test: `src/lib/inbox/grounding.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `appFaq: string` (from `app-faq.ts`)
  - Types `GroundingService { name: string; category: string; starting_price: number; duration_hours: number | null }`, `GroundingProduct { name: string; brand: string | null; category: string; price: number; in_stock: boolean }`, `GroundingBooking { booking_code: string; status: string; vehicle_label: string; service_name: string }`, `ConciergeContext { services: GroundingService[]; products: GroundingProduct[]; bookings: GroundingBooking[] }`
  - `buildConciergeSystemPrompt(ctx: ConciergeContext): string` — pure.

- [ ] **Step 1: Write the FAQ content**

Create `src/content/app-faq.ts`:

```ts
// Curated facts the concierge may state about Eagles 4x4 and how the app works.
// Keep to verifiable, non-pricing facts; the catalog supplies prices.
export const appFaq = `
Eagles 4x4 Offroad is a 4x4 build, parts, and service shop based in Dasmariñas, Cavite, Philippines.

How booking works:
- Customers book a service online and choose a date and time.
- You can book as a guest (no account) or sign in to track bookings and chat here.
- A booking has a status: pending, confirmed, in progress, parts installed, quality check, ready, completed.
- To change or cancel a booking, the team handles it — say you will pass it to them.

About this inbox:
- This chat is for questions about services, products, and how the shop works.
- The team replies here during shop hours; the assistant answers common questions any time.
`.trim()
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/inbox/grounding.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildConciergeSystemPrompt, type ConciergeContext } from './grounding'

const ctx: ConciergeContext = {
  services: [
    { name: 'Suspension Lift', category: 'suspension', starting_price: 25000, duration_hours: 6 },
  ],
  products: [
    { name: 'Profender Shocks', brand: 'Profender', category: 'suspension', price: 18000, in_stock: true },
    { name: 'Old Stock Bar', brand: null, category: 'protection', price: 5000, in_stock: false },
  ],
  bookings: [
    { booking_code: 'EAG-1001', status: 'completed', vehicle_label: '2018 Toyota Hilux', service_name: 'Suspension Lift' },
  ],
}

describe('buildConciergeSystemPrompt', () => {
  it('includes services with prices', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('Suspension Lift')
    expect(p).toContain('25000')
  })

  it('marks out-of-stock products', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('Old Stock Bar')
    expect(p).toMatch(/out of stock/i)
  })

  it('includes the customer bookings and the app FAQ', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('EAG-1001')
    expect(p).toMatch(/Dasmari/i) // from appFaq
  })

  it('instructs handoff and no price invention', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toMatch(/needs_human/)
    expect(p).toMatch(/do not (make up|invent)/i)
  })

  it('handles empty context without throwing', () => {
    const p = buildConciergeSystemPrompt({ services: [], products: [], bookings: [] })
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/inbox/grounding.test.ts`
Expected: FAIL — cannot find module `./grounding`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/inbox/grounding.ts`:

```ts
import { appFaq } from '@/content/app-faq'

export interface GroundingService {
  name: string
  category: string
  starting_price: number
  duration_hours: number | null
}
export interface GroundingProduct {
  name: string
  brand: string | null
  category: string
  price: number
  in_stock: boolean
}
export interface GroundingBooking {
  booking_code: string
  status: string
  vehicle_label: string
  service_name: string
}
export interface ConciergeContext {
  services: GroundingService[]
  products: GroundingProduct[]
  bookings: GroundingBooking[]
}

function serviceLine(s: GroundingService): string {
  const dur = s.duration_hours ? `, ~${s.duration_hours}h` : ''
  return `- ${s.name} (${s.category}) — starting at PHP ${s.starting_price}${dur}`
}
function productLine(p: GroundingProduct): string {
  const brand = p.brand ? `${p.brand} ` : ''
  const stock = p.in_stock ? 'in stock' : 'out of stock'
  return `- ${brand}${p.name} (${p.category}) — PHP ${p.price} (${stock})`
}
function bookingLine(b: GroundingBooking): string {
  return `- ${b.booking_code}: ${b.service_name} on ${b.vehicle_label} — status: ${b.status}`
}

/** Build the concierge system prompt from live catalog + the customer's bookings. Pure. */
export function buildConciergeSystemPrompt(ctx: ConciergeContext): string {
  const services = ctx.services.length
    ? ctx.services.map(serviceLine).join('\n')
    : '(no services listed)'
  const products = ctx.products.length
    ? ctx.products.map(productLine).join('\n')
    : '(no products listed)'
  const bookings = ctx.bookings.length
    ? ctx.bookings.map(bookingLine).join('\n')
    : '(this customer has no bookings on record)'

  return `You are the customer assistant for Eagles 4x4 Offroad, replying inside the shop's chat inbox.

${appFaq}

SERVICES:
${services}

PRODUCTS:
${products}

THIS CUSTOMER'S BOOKINGS:
${bookings}

RULES:
- Only answer using the SERVICES, PRODUCTS, app facts, and this customer's bookings above.
- Do not make up products, prices, stock, or facts that are not listed. Quote prices exactly as written.
- Be warm, brief, and helpful. Filipino-friendly tone is fine.
- For anything you cannot answer from the information above — complex or custom builds, technical diagnostics, exact custom quotes, complaints, or booking changes/cancellations — do NOT guess. Tell the customer you'll get the team to follow up here or by call, and set needs_human to true.
- Reply ONLY as JSON matching the schema: an object with "reply" (your message to the customer) and "needs_human" (boolean).`
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/inbox/grounding.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/app-faq.ts src/lib/inbox/grounding.ts src/lib/inbox/grounding.test.ts
git commit -m "feat(inbox): concierge grounding prompt + app FAQ"
```

---

## Task 2: Concierge Claude caller (raw fetch, tested)

**Files:**
- Create: `src/lib/inbox/concierge.ts`
- Test: `src/lib/inbox/concierge.test.ts`

**Interfaces:**
- Consumes: `sanitizeForPrompt` (`@/lib/sanitize`).
- Produces:
  - `CONCIERGE_MODEL = 'claude-haiku-4-5'`
  - `ConciergeTurn { role: 'user' | 'assistant'; text: string }`
  - `conciergeCostUsd(usage: { input_tokens: number; output_tokens: number }): number`
  - `generateConciergeReply(args: { systemPrompt: string; history: ConciergeTurn[]; apiKey: string; fetchImpl?: typeof fetch }): Promise<{ ok: true; reply: string; needsHuman: boolean; costUsd: number } | { ok: false; error: string }>`

Notes: `history` is already role-mapped (customer→`user`, bot/merchant→`assistant`) and is sanitized inside this function. The last entry is the newest customer message. Mirrors `emailSender`'s injectable-fetch shape.

- [ ] **Step 1: Write the failing test**

Create `src/lib/inbox/concierge.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { generateConciergeReply, conciergeCostUsd, CONCIERGE_MODEL } from './concierge'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response
}

describe('conciergeCostUsd', () => {
  it('prices Haiku input at $1 and output at $5 per 1M', () => {
    expect(conciergeCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(6)
  })
})

describe('generateConciergeReply', () => {
  it('posts to the messages API with the model and system prompt, and parses structured output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify({ reply: 'We have Profender shocks!', needs_human: false }) }],
        usage: { input_tokens: 1200, output_tokens: 40 },
      }),
    )
    const res = await generateConciergeReply({
      systemPrompt: 'SYSTEM',
      history: [{ role: 'user', text: 'do you have shocks?' }],
      apiKey: 'sk-test',
      fetchImpl,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.reply).toContain('Profender')
      expect(res.needsHuman).toBe(false)
      expect(res.costUsd).toBeGreaterThan(0)
    }
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe(CONCIERGE_MODEL)
    expect(body.system).toBe('SYSTEM')
    expect(body.thinking).toBeUndefined()
    expect((init as RequestInit).headers).toMatchObject({ 'anthropic-version': '2023-06-01' })
  })

  it('returns needsHuman true when the model flags handoff', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify({ reply: "I'll get the team.", needs_human: true }) }],
        usage: { input_tokens: 800, output_tokens: 20 },
      }),
    )
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'build me a comp truck' }], apiKey: 'k', fetchImpl })
    expect(res.ok && res.needsHuman).toBe(true)
  })

  it('returns ok:false on a non-200 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad' }, false, 400))
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'hi' }], apiKey: 'k', fetchImpl })
    expect(res.ok).toBe(false)
  })

  it('returns ok:false on unparseable model output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'not json' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    )
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'hi' }], apiKey: 'k', fetchImpl })
    expect(res.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inbox/concierge.test.ts`
Expected: FAIL — cannot find module `./concierge`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/inbox/concierge.ts`:

```ts
import { sanitizeForPrompt } from '@/lib/sanitize'

export const CONCIERGE_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 600
const INPUT_USD_PER_TOKEN = 1 / 1_000_000
const OUTPUT_USD_PER_TOKEN = 5 / 1_000_000

export interface ConciergeTurn {
  role: 'user' | 'assistant'
  text: string
}

export function conciergeCostUsd(usage: { input_tokens: number; output_tokens: number }): number {
  return usage.input_tokens * INPUT_USD_PER_TOKEN + usage.output_tokens * OUTPUT_USD_PER_TOKEN
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    needs_human: { type: 'boolean' },
  },
  required: ['reply', 'needs_human'],
  additionalProperties: false,
} as const

type ConciergeResult =
  | { ok: true; reply: string; needsHuman: boolean; costUsd: number }
  | { ok: false; error: string }

interface MessagesResponse {
  content?: { type: string; text?: string }[]
  usage?: { input_tokens: number; output_tokens: number }
}

/** Call the Claude Messages API (raw REST) for a grounded concierge reply. */
export async function generateConciergeReply(args: {
  systemPrompt: string
  history: ConciergeTurn[]
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<ConciergeResult> {
  const doFetch = args.fetchImpl ?? fetch
  const messages = args.history.map(t => ({
    role: t.role,
    content: sanitizeForPrompt(t.text, 2000),
  }))

  let res: Response
  try {
    res = await doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CONCIERGE_MODEL,
        max_tokens: MAX_TOKENS,
        system: args.systemPrompt,
        messages,
        output_config: { format: { type: 'json_schema', schema: REPLY_SCHEMA } },
      }),
    })
  } catch (err) {
    return { ok: false, error: `concierge fetch failed: ${String(err)}` }
  }

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `claude ${res.status}: ${text}` }
  }

  const json = (await res.json()) as MessagesResponse
  const text = json.content?.find(b => b.type === 'text')?.text
  if (!text) return { ok: false, error: 'no text block in response' }

  let parsed: { reply?: unknown; needs_human?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'model output was not valid JSON' }
  }
  if (typeof parsed.reply !== 'string' || typeof parsed.needs_human !== 'boolean') {
    return { ok: false, error: 'model output missing reply/needs_human' }
  }

  const usage = json.usage ?? { input_tokens: 0, output_tokens: 0 }
  return { ok: true, reply: parsed.reply, needsHuman: parsed.needs_human, costUsd: conciergeCostUsd(usage) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inbox/concierge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbox/concierge.ts src/lib/inbox/concierge.test.ts
git commit -m "feat(inbox): concierge Claude caller (raw fetch, structured output)"
```

---

## Task 3: Store helpers — merchant-online check + status setter

**Files:**
- Modify: `src/lib/inbox/store.ts`

**Interfaces:**
- Consumes: existing `createInboxStore`, types from `@/types/inbox`.
- Produces (added to the store object):
  - `isAnyMerchantOnline(): Promise<boolean>`
  - `setStatus(conversationId: string, status: ConversationStatus): Promise<void>`
  - `getContextBookings(customerId: string): Promise<GroundingBooking[]>` is **out of scope here** — booking fetch lives in Task 4's grounding loader.

- [ ] **Step 1: Add the methods**

In `src/lib/inbox/store.ts`, update the import and add two methods to the returned object. Change the type import line:

```ts
import type { Conversation, ConversationMessage, ConversationStatus, MessageSender } from '@/types/inbox'
```

Add these methods inside the object returned by `createInboxStore` (after `markDoorbellSent`):

```ts
    async isAnyMerchantOnline(): Promise<boolean> {
      const { data, error } = await client
        .from('merchant_presence')
        .select('merchant_id')
        .eq('online', true)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`isAnyMerchantOnline: ${error.message}`)
      return data !== null
    },

    async setStatus(conversationId: string, status: ConversationStatus): Promise<void> {
      const { error } = await client
        .from('conversations')
        .update({ status })
        .eq('id', conversationId)
      if (error) throw new Error(`setStatus: ${error.message}`)
    },
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inbox/store.ts
git commit -m "feat(inbox): store helpers for merchant-online check + status set"
```

---

## Task 4: Wire the concierge into the customer send action

**Files:**
- Modify: `src/app/inbox/actions.ts`

**Interfaces:**
- Consumes: `createServiceRoleClient` (`@/utils/supabase/server`), `createInboxStore`, `buildConciergeSystemPrompt` + grounding types, `generateConciergeReply` + `ConciergeTurn`, `checkAiBudget`/`recordAiUsage` (`@/utils/ratelimit`).
- Produces: internal `maybeRunConcierge(conversationId, customerId)`; no new exports.

The concierge runs **after** the customer message is inserted, inside `sendCustomerMessage`, wrapped so any failure is swallowed (the customer message already persisted; status stays `awaiting_merchant`).

- [ ] **Step 1: Update the imports**

In `src/app/inbox/actions.ts`, replace the supabase-server import and add the new ones:

```ts
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { createInboxStore } from '@/lib/inbox/store'
import { messageBodySchema } from '@/lib/inbox/message'
import { buildConciergeSystemPrompt, type ConciergeContext, type GroundingBooking } from '@/lib/inbox/grounding'
import { generateConciergeReply, type ConciergeTurn } from '@/lib/inbox/concierge'
import { rlServerAction, checkLimit, checkAiBudget, recordAiUsage } from '@/utils/ratelimit'
```

- [ ] **Step 2: Call the concierge after a successful customer insert**

In `sendCustomerMessage`, after `await store.insertMessage({ ... sender: 'customer' ... })` succeeds and before `revalidatePath('/inbox')`, add:

```ts
    await maybeRunConcierge(convo.id, user.id)
```

(Keep it inside the existing `try`; `maybeRunConcierge` itself never throws — see Step 3.)

- [ ] **Step 3: Add the concierge orchestrator**

Append to `src/app/inbox/actions.ts`:

```ts
// Reuses the booking shaping the touchpoint store already does.
const CONTEXT_BOOKING_SELECT = `
  booking_code, status,
  vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
  vehicles ( make, model, year ),
  booking_items ( name_snapshot, item_type )
`

interface RawContextBooking {
  booking_code: string
  status: string
  vehicle_make_snapshot: string | null
  vehicle_model_snapshot: string | null
  vehicle_year_snapshot: number | null
  vehicles: { make: string | null; model: string | null; year: number | null } | null
  booking_items: { name_snapshot: string; item_type: string }[] | null
}

function bookingVehicleLabel(b: RawContextBooking): string {
  const v = b.vehicles
  const make = v?.make ?? b.vehicle_make_snapshot
  const model = v?.model ?? b.vehicle_model_snapshot
  const year = v?.year ?? b.vehicle_year_snapshot
  if (!make && !model) return 'your vehicle'
  return [year, make, model].filter(Boolean).join(' ').trim()
}

function bookingServiceName(b: RawContextBooking): string {
  return (b.booking_items ?? []).find(i => i.item_type === 'service')?.name_snapshot ?? 'a service'
}

// Run the AI concierge for a freshly-received customer message. Never throws.
async function maybeRunConcierge(conversationId: string, customerId: string): Promise<void> {
  try {
    const admin = createServiceRoleClient()
    const store = createInboxStore(admin)

    // A human is present — let them answer.
    if (await store.isAnyMerchantOnline()) return

    const budget = await checkAiBudget('customer', customerId)
    if (!budget.allowed) return // stays awaiting_merchant; a human will pick it up

    // Build grounding context.
    const [servicesRes, productsRes, bookingsRes, messages] = await Promise.all([
      admin.from('services').select('name, category, starting_price, duration_hours').eq('is_active', true),
      admin.from('products').select('name, brand, category, price, stock').eq('is_active', true),
      admin.from('bookings').select(CONTEXT_BOOKING_SELECT).eq('customer_id', customerId).returns<RawContextBooking[]>(),
      store.listMessages(conversationId),
    ])
    if (servicesRes.error || productsRes.error || bookingsRes.error) {
      console.error('[concierge] grounding load', servicesRes.error ?? productsRes.error ?? bookingsRes.error)
      return
    }

    const bookings: GroundingBooking[] = (bookingsRes.data ?? []).map(b => ({
      booking_code: b.booking_code,
      status: b.status,
      vehicle_label: bookingVehicleLabel(b),
      service_name: bookingServiceName(b),
    }))
    const ctx: ConciergeContext = {
      services: (servicesRes.data ?? []).map(s => ({
        name: s.name, category: s.category, starting_price: Number(s.starting_price), duration_hours: s.duration_hours,
      })),
      products: (productsRes.data ?? []).map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: Number(p.price), in_stock: Number(p.stock) > 0,
      })),
      bookings,
    }

    // Last 10 turns, oldest→newest, role-mapped.
    const history: ConciergeTurn[] = messages
      .slice(-10)
      .map(m => ({ role: m.sender === 'customer' ? 'user' : 'assistant', text: m.body }))

    const result = await generateConciergeReply({
      systemPrompt: buildConciergeSystemPrompt(ctx),
      history,
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    })
    if (!result.ok) {
      console.error('[concierge] generate', result.error)
      return
    }

    await store.insertMessage({ conversationId, sender: 'bot', body: result.reply })
    // insertMessage set status to 'open' (non-customer sender). If the bot punted,
    // re-flag so the conversation surfaces in the admin queue.
    if (result.needsHuman) await store.setStatus(conversationId, 'awaiting_merchant')

    await recordAiUsage('customer', customerId, result.costUsd)
  } catch (err) {
    console.error('[maybeRunConcierge]', err)
  }
}
```

- [ ] **Step 4: Verify build + types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/inbox/actions.ts
git commit -m "feat(inbox): run AI concierge on customer message when no merchant online"
```

---

## Task 5: Verification + regression

**Files:** none (verification only). Requires `ANTHROPIC_API_KEY` set in the environment.

- [ ] **Step 1: Full unit suite**

Run: `npm run test`
Expected: all green, including new `grounding.test.ts` (5) and `concierge.test.ts` (5).

- [ ] **Step 2: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean. (If the build hits the disk constraint, record it and rely on the Vercel preview build.)

- [ ] **Step 3: Manual runtime verification**

With `ANTHROPIC_API_KEY` set, dev server running, signed in as a customer, **no merchant online** (`merchant_presence.online` false/absent):
1. Send "Do you have suspension lift kits?" → a `sender='bot'` reply appears live, grounded in the real catalog, with correct prices. Verify the bot row + `recordAiUsage` (Redis key `eagles4x4:ai:usd:customer:<id>:<date>`).
2. Send "Can you build me a custom competition truck?" → bot replies with a handoff message and the conversation flips to `awaiting_merchant` (verify via Supabase MCP `execute_sql`; the "new" badge shows in `/admin/inbox`).
3. Set a merchant online (presence toggle in `/admin/inbox`), send another customer message → **no** bot reply (human handles it).
4. Confirm a bot failure path is safe: temporarily unset `ANTHROPIC_API_KEY`, send a message → the customer message still persists, no crash, status stays `awaiting_merchant`.

- [ ] **Step 4: Update env documentation**

Note `ANTHROPIC_API_KEY` in the project's env list / deployment notes (alongside `RESEND_API_KEY`, `CRON_SECRET`).

---

## Self-Review

**Spec coverage (§5 AI concierge):**
- AI grounded in services + products + app FAQ + customer bookings — Tasks 1, 4 ✓
- Guardrails: `sanitizeForPrompt`, `checkAiBudget`/`recordAiUsage`, no invented prices — Tasks 2, 4 ✓
- Escape hatch → `awaiting_merchant` on `needs_human` — Tasks 2–4 ✓
- Bot only replies when no merchant online — Task 3/4 ✓
- Bot writes via service role — Task 4 ✓

**Placeholder scan:** none — every code step is complete; the one conditional (`needs_human`) is fully handled.

**Type consistency:** `ConciergeContext`/`GroundingBooking` (Task 1) are consumed unchanged in Task 4. `ConciergeTurn` and `generateConciergeReply`'s result shape (Task 2) match their use in Task 4. `isAnyMerchantOnline`/`setStatus` (Task 3) are called exactly as defined. `conciergeCostUsd` is internal to Task 2 and re-exported only for its test.

**Deferred:** streaming the bot reply token-by-token (not needed — realtime delivers the finished message); multi-language detection (Filipino tone is handled by the prompt). Browser push remains a separate future plan.
```
