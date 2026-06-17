# Touchpoints Admin UI Implementation Plan (Part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/touchpoints` dashboard so staff can work the daily queue — review/edit chat drafts, fire one-tap Copy + Viber/Messenger/WhatsApp/SMS/Call links, mark sent, track replied/no-response, manually send a touchpoint early, and edit the message templates.

**Architecture:** A Server Component page reads touchpoints (joined to bookings for contact info) and renders two sections — **Needs sending** (pending chat) and **Recently sent** (log). Client components handle interactivity via Server Actions, following the existing admin pattern (`requireAdmin` + rate guard + Zod + `revalidatePath`). Click-to-chat links are rebuilt client-side from the (editable) message using the pure `buildChatLinks` util from Part 1. Manual early-send reuses a new single-touchpoint engine function.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Server Actions, Supabase (RLS, admin policies), Tailwind + CSS vars, Playwright (e2e). No new dependencies.

**Depends on:** Part 1 (`2026-06-17-touchpoints-engine.md`) fully merged — needs the `touchpoints`/`touchpoint_templates` tables, `buildChatLinks`, `renderTemplate`/`buildTokens`, the engine, and the Supabase store.

**Spec:** `docs/superpowers/specs/2026-06-17-touchpoints-design.md` §6–§9.

**Scope note:** AI "✨ Suggest" is **not** in this plan — it's a later optional task (needs `ANTHROPIC_API_KEY`). The Suggest button is left out of the markup; adding it later is additive.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/touchpoints/engine.ts` (modify) | Add `createTouchpointForBooking` (single, manual/early) + `getBookingById` to `TouchpointStore` |
| `src/lib/touchpoints/store.supabase.ts` (modify) | Implement `getBookingById` |
| `src/app/admin/touchpoints/actions.ts` | Server actions: `markSent`, `setTouchpointStatus`, `manualSend`, `saveTemplate` |
| `src/app/admin/touchpoints/page.tsx` | Server Component: fetch + render the two sections |
| `src/app/admin/touchpoints/SendRow.tsx` | Client: editable draft, Copy, channel buttons, Mark sent |
| `src/app/admin/touchpoints/SentLogRow.tsx` | Client: status dropdown (replied / no-response) |
| `src/app/admin/touchpoints/ManualSend.tsx` | Client: pick booking + type → send now |
| `src/app/admin/touchpoints/templates/page.tsx` | Server Component: list templates |
| `src/app/admin/touchpoints/templates/TemplateForm.tsx` | Client: edit subject/body |
| `src/app/admin/page.tsx` (modify) | Add the Touchpoints tile to the hub |
| `e2e/touchpoints-admin.spec.ts` | Playwright e2e for the queue flow |

---

## Task 1: Single-touchpoint engine function (for manual early-send)

Manual send creates one touchpoint for a specific booking + type regardless of the due date, reusing the same render/channel logic. Add `getBookingById` to the store interface and a `createTouchpointForBooking` orchestrator function.

**Files:**
- Modify: `src/lib/touchpoints/engine.ts`
- Test: `src/lib/touchpoints/engine.test.ts` (extend)

- [ ] **Step 1: Write the failing test** (append to the `runTouchpointEngine` test file)

```ts
import { createTouchpointForBooking } from '@/lib/touchpoints/engine'

describe('createTouchpointForBooking', () => {
  it('renders + queues a chat touchpoint for an email-less booking', async () => {
    const b = booking({ id: 'bx', contact_email: null })
    const store = {
      async getBookingById() { return b },
      async getTemplate() { return { subject: null, body: 'Hi {{customer_name}}' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent() { return { id: 'tp1' } },
      async markSent() {},
      async findDueBookings() { return [] },
    }
    const sender = { async send() { return { ok: true } } }
    const r = await createTouchpointForBooking({
      bookingId: 'bx', type: 'appointment_reminder', shopName: 'Eagles',
      store, emailSender: sender,
    })
    expect(r).toEqual({ ok: true, channel: 'chat', id: 'tp1' })
  })
  it('returns already_exists when the touchpoint is a duplicate', async () => {
    const store = {
      async getBookingById() { return booking({ id: 'bx' }) },
      async getTemplate() { return { subject: null, body: 'Hi' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent() { return null },
      async markSent() {},
      async findDueBookings() { return [] },
    }
    const r = await createTouchpointForBooking({
      bookingId: 'bx', type: 'post_service', shopName: 'X',
      store, emailSender: { async send() { return { ok: true } } },
    })
    expect(r).toEqual({ ok: false, reason: 'already_exists' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: FAIL (`createTouchpointForBooking` / `getBookingById` missing).

- [ ] **Step 3: Implement** — add to `engine.ts`

Add `getBookingById` to the `TouchpointStore` interface:
```ts
  /** Fetch one booking shaped for touchpoints, or null. */
  getBookingById(id: string): Promise<DueBooking | null>
```
Add the function (reuses the same render/channel/send logic):
```ts
export type CreateTouchpointResult =
  | { ok: true; channel: TouchpointChannel; id: string }
  | { ok: false; reason: 'not_found' | 'already_exists' | 'send_failed' }

export async function createTouchpointForBooking(opts: {
  bookingId: string
  type: TouchpointType
  shopName: string
  store: TouchpointStore
  emailSender: TouchpointSender
  unsubscribe?: { baseUrl: string; secret: string }
}): Promise<CreateTouchpointResult> {
  const { bookingId, type, shopName, store, emailSender } = opts
  const b = await store.getBookingById(bookingId)
  if (!b) return { ok: false, reason: 'not_found' }

  const suppressed = b.contact_email ? await store.isEmailSuppressed(b.contact_email) : false
  const channel = resolveChannel(b, suppressed)
  const tpl = await store.getTemplate(type, channel)
  const tokens = buildTokens(b, shopName)
  const message = renderTemplate(tpl.body, tokens)
  const subject = tpl.subject ? renderTemplate(tpl.subject, tokens) : null

  const inserted = await store.insertIfAbsent({
    booking_id: b.id, customer_id: b.customer_id, vehicle_id: b.vehicle_id,
    type, channel, subject, message_sent: message,
  })
  if (!inserted) return { ok: false, reason: 'already_exists' }

  if (channel === 'email' && b.contact_email) {
    let body = message
    if (opts.unsubscribe) {
      const t = signUnsubscribe(b.contact_email, opts.unsubscribe.secret)
      body = `${message}\n\n— \nUnsubscribe: ${opts.unsubscribe.baseUrl}/api/touchpoints/unsubscribe?e=${encodeURIComponent(b.contact_email)}&t=${t}`
    }
    const res = await emailSender.send({ to: b.contact_email, subject: subject ?? '', body })
    if (!res.ok) return { ok: false, reason: 'send_failed' }
    await store.markSent(inserted.id)
  }
  return { ok: true, channel, id: inserted.id }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Implement `getBookingById` in the Supabase store** — add to `store.supabase.ts`

```ts
    async getBookingById(id: string): Promise<DueBooking | null> {
      const { data, error } = await admin.from('bookings').select(SELECT).eq('id', id).maybeSingle()
      if (error) throw new Error(`getBookingById: ${error.message}`)
      return data ? toDueBooking(data as unknown as BookingRow) : null
    },
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/lib/touchpoints/engine.ts src/lib/touchpoints/engine.test.ts src/lib/touchpoints/store.supabase.ts
git commit -m "feat(touchpoints): single-touchpoint create for manual early-send"
```

---

## Task 2: Server actions

**Files:**
- Create: `src/app/admin/touchpoints/actions.ts`

- [ ] **Step 1: Write the actions** (mirrors the events actions pattern)

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeMultiline, sanitizeText } from '@/lib/sanitize'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'
import { createTouchpointForBooking, type CreateTouchpointResult } from '@/lib/touchpoints/engine'
import { createSupabaseTouchpointStore } from '@/lib/touchpoints/store.supabase'
import { emailSender } from '@/lib/touchpoints/channels'
import { BRAND } from '@/content/brand' // adjust to the real export (see Part 1 Task 10 Step 1)
import { TOUCHPOINT_TYPES, type TouchpointType } from '@/types/touchpoints'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}
async function adminRateGuard(userId: string) {
  const r = await checkLimit(rlAdminGeneral, `touchpoints-action:${userId}:${await getIp()}`)
  return r.allowed
}

// Mark a chat touchpoint sent (staff-attested), persisting the final edited text.
export async function markSent(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid id.' }
  const finalText = sanitizeMultiline(formData.get('message') ?? '', 2000)

  const supabase = await createClient()
  const { error } = await supabase.from('touchpoints')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_by: user.id, message_sent: finalText })
    .eq('id', id)
  if (error) return { error: 'Could not mark sent.' }
  revalidatePath('/admin/touchpoints')
  return { success: true }
}

// Flip a sent touchpoint to replied / no_response (manual tracking).
export async function setTouchpointStatus(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid id.' }
  const status = String(formData.get('status') ?? '')
  if (!['sent', 'replied', 'no_response'].includes(status)) return { error: 'Invalid status.' }

  const supabase = await createClient()
  const { error } = await supabase.from('touchpoints').update({ status }).eq('id', id)
  if (error) return { error: 'Could not update status.' }
  revalidatePath('/admin/touchpoints')
  return { success: true }
}

// Manually create + (for email) send a touchpoint now, ignoring the due date.
export async function manualSend(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const bookingId = String(formData.get('booking_id') ?? '')
  if (!z.string().uuid().safeParse(bookingId).success) return { error: 'Invalid booking id.' }
  const type = String(formData.get('type') ?? '') as TouchpointType
  if (!TOUCHPOINT_TYPES.includes(type)) return { error: 'Invalid type.' }

  const result: CreateTouchpointResult = await createTouchpointForBooking({
    bookingId, type, shopName: BRAND.name,
    store: createSupabaseTouchpointStore(),
    emailSender: emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    }),
    unsubscribe: process.env.TOUCHPOINT_UNSUBSCRIBE_SECRET
      ? { baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', secret: process.env.TOUCHPOINT_UNSUBSCRIBE_SECRET }
      : undefined,
  })
  revalidatePath('/admin/touchpoints')
  if (!result.ok) {
    const msg = result.reason === 'already_exists' ? 'A touchpoint of this type already exists for that booking.'
      : result.reason === 'not_found' ? 'Booking not found.' : 'Could not send.'
    return { error: msg }
  }
  return { success: true, channel: result.channel }
}

// Edit a template (admin-editable wording).
export async function saveTemplate(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid template id.' }
  const subjectRaw = formData.get('subject')
  const subject = subjectRaw ? sanitizeText(subjectRaw, 200) : null
  const body = sanitizeMultiline(formData.get('body') ?? '', 2000)
  if (!body) return { error: 'Body is required.' }

  const supabase = await createClient()
  const { error } = await supabase.from('touchpoint_templates')
    .update({ subject, body, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('id', id)
  if (error) return { error: 'Could not save template.' }
  revalidatePath('/admin/touchpoints/templates')
  return { success: true }
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/app/admin/touchpoints/actions.ts
git commit -m "feat(admin): touchpoint server actions (mark sent, status, manual send, save template)"
```

---

## Task 3: Dashboard page + SendRow + SentLogRow

**Files:**
- Create: `src/app/admin/touchpoints/page.tsx`
- Create: `src/app/admin/touchpoints/SendRow.tsx`
- Create: `src/app/admin/touchpoints/SentLogRow.tsx`

- [ ] **Step 1: SendRow (client)** — editable draft + Copy + channel buttons + Mark sent

```tsx
'use client'

import { useState, useTransition } from 'react'
import { buildChatLinks } from '@/lib/touchpoints/chatLinks'
import { markSent } from './actions'

const TYPE_LABEL: Record<string, string> = {
  appointment_reminder: '⏰ Reminder',
  post_service: '🔧 Post-service',
  pms_reminder: '🛠 PMS',
}

export default function SendRow(props: Readonly<{
  id: string
  type: string
  bookingCode: string
  customerName: string
  phone: string | null
  facebook: string | null
  draft: string
}>) {
  const [message, setMessage] = useState(props.draft)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()
  const links = buildChatLinks({ phone: props.phone, facebook: props.facebook, message })

  function copy() { void navigator.clipboard.writeText(message) }
  function mark() {
    const fd = new FormData(); fd.set('id', props.id); fd.set('message', message)
    startTransition(async () => { const r = await markSent(fd); if (!r?.error) setDone(true) })
  }

  if (done) return null

  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xs font-bold tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
        {TYPE_LABEL[props.type] ?? props.type} · {props.customerName} · {props.bookingCode}
      </div>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        aria-label="Message to send"
        className="w-full rounded-md p-2 text-sm"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="text-xs px-3 py-1 rounded-full font-semibold"
          style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}>Copy</button>
        {links.viber && <a className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }} href={links.viber}>Viber</a>}
        {links.messenger && <a className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(0,132,255,0.12)', color: '#0084ff' }} href={links.messenger} target="_blank" rel="noreferrer">Messenger</a>}
        {links.whatsapp && <a className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366' }} href={links.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
        {links.sms && <a className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }} href={links.sms}>SMS</a>}
        {links.tel && <a className="text-xs px-3 py-1 rounded-full font-semibold" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }} href={links.tel}>Call</a>}
        <button type="button" onClick={mark} disabled={pending}
          className="text-xs px-3 py-1 rounded-full font-bold ml-auto disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}>
          {pending ? '…' : 'Mark sent'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: SentLogRow (client)** — status dropdown

```tsx
'use client'

import { useTransition } from 'react'
import { setTouchpointStatus } from './actions'

export default function SentLogRow(props: Readonly<{
  id: string; type: string; customerName: string; channel: string; status: string; sentAt: string | null; sentByLabel: string
}>) {
  const [pending, startTransition] = useTransition()
  function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const fd = new FormData(); fd.set('id', props.id); fd.set('status', e.target.value)
    startTransition(async () => { await setTouchpointStatus(fd) })
  }
  const when = props.sentAt ? new Date(props.sentAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const channelLabel = props.channel === 'email' ? 'auto-email' : props.sentByLabel

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm" style={{ borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>
        {props.type} · {props.customerName} · {channelLabel} · {when}
      </span>
      <select value={props.status} onChange={change} disabled={pending} aria-label="Touchpoint status"
        className="text-xs rounded-md px-2 py-1"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
        <option value="sent">sent</option>
        <option value="replied">replied</option>
        <option value="no_response">no response</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Dashboard page (Server Component)**

```tsx
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import SendRow from './SendRow'
import SentLogRow from './SentLogRow'
import ManualSend from './ManualSend'

export const dynamic = 'force-dynamic'

interface Row {
  id: string; type: string; channel: string; status: string; message_sent: string | null
  subject: string | null; sent_at: string | null
  sent_by_profile: { full_name: string | null } | null
  booking: { booking_code: string; contact_phone: string | null; contact_facebook: string | null
    customer: { full_name: string | null } | null } | null
}

export default async function TouchpointsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const select = `id, type, channel, status, message_sent, subject, sent_at,
    sent_by_profile:sent_by ( full_name ),
    booking:booking_id ( booking_code, contact_phone, contact_facebook, customer:customer_id ( full_name ) )`

  const { data: needsRaw } = await supabase.from('touchpoints')
    .select(select).eq('channel', 'chat').eq('status', 'pending').order('scheduled_at', { ascending: true })
  const { data: sentRaw } = await supabase.from('touchpoints')
    .select(select).in('status', ['sent', 'replied', 'no_response']).order('sent_at', { ascending: false }).limit(50)

  const needs = (needsRaw ?? []) as unknown as Row[]
  const sent = (sentRaw ?? []) as unknown as Row[]
  const name = (r: Row) => r.booking?.customer?.full_name?.split(' ')[0] || 'Guest'

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Touchpoints</h1>
        <Link href="/admin/touchpoints/templates" className="text-sm underline" style={{ color: 'var(--color-accent)' }}>Edit templates</Link>
      </div>

      <ManualSend />

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-secondary)' }}>
          Needs sending ({needs.length})
        </h2>
        {needs.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Nothing to send right now. 🎉</p>}
        {needs.map(r => (
          <SendRow key={r.id} id={r.id} type={r.type} bookingCode={r.booking?.booking_code ?? '—'}
            customerName={name(r)} phone={r.booking?.contact_phone ?? null}
            facebook={r.booking?.contact_facebook ?? null} draft={r.message_sent ?? ''} />
        ))}
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-secondary)' }}>Recently sent</h2>
        {sent.map(r => (
          <SentLogRow key={r.id} id={r.id} type={r.type} customerName={name(r)} channel={r.channel}
            status={r.status} sentAt={r.sent_at}
            sentByLabel={`marked sent by ${r.sent_by_profile?.full_name?.split(' ')[0] ?? 'staff'}`} />
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. Fix any Supabase embedded-relationship name mismatches (e.g. if the FK alias `customer:customer_id` must be `profiles:customer_id` — check against how `src/app/admin/bookings/page.tsx` joins the customer).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/touchpoints/page.tsx src/app/admin/touchpoints/SendRow.tsx src/app/admin/touchpoints/SentLogRow.tsx
git commit -m "feat(admin): touchpoints dashboard (needs-sending queue + recently-sent log)"
```

---

## Task 4: Manual early-send component

**Files:**
- Create: `src/app/admin/touchpoints/ManualSend.tsx`

- [ ] **Step 1: Implement** (a booking-code input + type select → `manualSend`; the action resolves the code → id server-side)

First extend `manualSend` to accept a booking **code** (friendlier than a UUID). In `actions.ts`, before the UUID branch, resolve a code to an id:
```ts
  // In manualSend: accept either a booking_id (uuid) or a booking_code.
  let bookingId = String(formData.get('booking_id') ?? '')
  if (!z.string().uuid().safeParse(bookingId).success) {
    const code = sanitizeText(formData.get('booking_id') ?? '', 32)
    const sb = await createClient()
    const { data } = await sb.from('bookings').select('id').eq('booking_code', code).maybeSingle()
    if (!data) return { error: 'No booking with that code.' }
    bookingId = data.id
  }
```
(Replace the existing `bookingId` line + its uuid guard in `manualSend` with the block above.)

Then the component:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { manualSend } from './actions'

export default function ManualSend() {
  const [code, setCode] = useState('')
  const [type, setType] = useState('appointment_reminder')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function send() {
    if (!code.trim()) { setMsg('Enter a booking code.'); return }
    const fd = new FormData(); fd.set('booking_id', code.trim()); fd.set('type', type)
    startTransition(async () => {
      const r = await manualSend(fd)
      setMsg(r?.error ? r.error : `Created (${r.channel === 'email' ? 'auto-emailed' : 'queued for chat'}).`)
      if (!r?.error) setCode('')
    })
  }

  return (
    <div className="rounded-lg border p-4 flex flex-wrap items-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex flex-col gap-1">
        <label htmlFor="ms-code" className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Send now — booking code</label>
        <input id="ms-code" value={code} onChange={e => setCode(e.target.value)} placeholder="E4X4-7Q2M"
          className="rounded-md px-2 py-1 text-sm" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
      </div>
      <select value={type} onChange={e => setType(e.target.value)} aria-label="Touchpoint type"
        className="rounded-md px-2 py-1 text-sm" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
        <option value="appointment_reminder">Reminder</option>
        <option value="post_service">Post-service</option>
        <option value="pms_reminder">PMS</option>
      </select>
      <button type="button" onClick={send} disabled={pending} className="text-xs px-3 py-1.5 rounded-full font-bold disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#fff' }}>{pending ? '…' : 'Send now'}</button>
      {msg && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{msg}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/app/admin/touchpoints/ManualSend.tsx src/app/admin/touchpoints/actions.ts
git commit -m "feat(admin): manual early-send by booking code"
```

---

## Task 5: Template editor

**Files:**
- Create: `src/app/admin/touchpoints/templates/page.tsx`
- Create: `src/app/admin/touchpoints/templates/TemplateForm.tsx`

- [ ] **Step 1: TemplateForm (client)**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { saveTemplate } from '../actions'

export default function TemplateForm(props: Readonly<{
  id: string; type: string; channel: string; subject: string | null; body: string
}>) {
  const [subject, setSubject] = useState(props.subject ?? '')
  const [body, setBody] = useState(props.body)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    const fd = new FormData(); fd.set('id', props.id)
    if (props.channel === 'email') fd.set('subject', subject)
    fd.set('body', body)
    startTransition(async () => { const r = await saveTemplate(fd); setMsg(r?.error ?? 'Saved.') })
  }

  return (
    <div className="rounded-lg border p-4 space-y-2" style={{ borderColor: 'var(--color-border)' }}>
      <div className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-secondary)' }}>
        {props.type} · {props.channel}
      </div>
      {props.channel === 'email' && (
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject"
          className="w-full rounded-md px-2 py-1 text-sm" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
      )}
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} aria-label="Body"
        className="w-full rounded-md p-2 text-sm" style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="text-xs px-3 py-1 rounded-full font-bold disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}>{pending ? '…' : 'Save'}</button>
        <span className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          Tokens: {'{{customer_name}} {{booking_code}} {{date}} {{time}} {{service}} {{vehicle}} {{shop_name}}'}
        </span>
        {msg && <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Templates page (Server Component)**

```tsx
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import TemplateForm from './TemplateForm'

export const dynamic = 'force-dynamic'

interface Tpl { id: string; type: string; channel: string; subject: string | null; body: string }

export default async function TemplatesPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from('touchpoint_templates')
    .select('id, type, channel, subject, body').order('type').order('channel')
  const tpls = (data ?? []) as Tpl[]

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Message templates</h1>
        <Link href="/admin/touchpoints" className="text-sm underline" style={{ color: 'var(--color-accent)' }}>← Back to queue</Link>
      </div>
      {tpls.map(t => <TemplateForm key={t.id} id={t.id} type={t.type} channel={t.channel} subject={t.subject} body={t.body} />)}
    </div>
  )
}
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/app/admin/touchpoints/templates/page.tsx src/app/admin/touchpoints/templates/TemplateForm.tsx
git commit -m "feat(admin): touchpoint template editor"
```

---

## Task 6: Add the Touchpoints tile to the admin hub

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Inspect the hub tile structure**

Run: `grep -n "href\|title\|comingSoon\|tile" src/app/admin/page.tsx | head -40`
Identify the array/markup of module tiles and whether tiles are objects (`{ title, href, ... }`) or inline JSX.

- [ ] **Step 2: Add a Touchpoints tile**

Following the exact shape found in Step 1, add a tile linking to `/admin/touchpoints` titled **"Touchpoints"** with a subtitle like *"Reminders & follow-ups"*. If tiles are config objects, add:
```ts
{ title: 'Touchpoints', subtitle: 'Reminders & follow-ups', href: '/admin/touchpoints' },
```
If tiles are inline JSX, copy an existing active tile (e.g. Bookings) and change its label/href/icon. Do **not** mark it `comingSoon`.

- [ ] **Step 3: Type-check + build + commit**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0; `/admin/touchpoints` and `/admin/touchpoints/templates` appear in the route list.
```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): add Touchpoints tile to the admin hub"
```

---

## Task 7: End-to-end test (Playwright) + final verification

**Files:**
- Create: `e2e/touchpoints-admin.spec.ts`

- [ ] **Step 1: Seed a sendable chat touchpoint**

In Supabase SQL editor (or MCP `execute_sql`), insert one pending chat touchpoint tied to an existing guest booking (no email) so the queue has a row:
```sql
insert into public.touchpoints (booking_id, type, channel, status, message_sent, scheduled_at)
select id, 'appointment_reminder', 'chat', 'pending',
       'Hi! Reminder: your booking ' || booking_code || ' is tomorrow.', now()
from public.bookings
where contact_phone is not null
order by created_at desc limit 1
on conflict (booking_id, type) do nothing;
```

- [ ] **Step 2: Write the e2e test** (uses the existing Playwright admin-auth setup — mirror `e2e/` admin login pattern; if tests run unauthenticated, point this at the admin login + storageState used by other admin specs)

```ts
import { test, expect } from '@playwright/test'

// Assumes admin is authenticated via the project's Playwright storageState.
test('touchpoints queue shows a sendable row with chat buttons', async ({ page }) => {
  await page.goto('/admin/touchpoints')
  await expect(page.getByRole('heading', { name: 'Touchpoints' })).toBeVisible()
  await expect(page.getByText('Needs sending')).toBeVisible()

  // The seeded chat row exposes an editable draft + a Mark sent button.
  const draft = page.getByLabel('Message to send').first()
  await expect(draft).toBeVisible()
  // WhatsApp/SMS links are present for a phone-having booking.
  await expect(page.getByRole('link', { name: 'WhatsApp' }).first()).toBeVisible()

  // Mark sent removes the row from the queue.
  await page.getByRole('button', { name: 'Mark sent' }).first().click()
  await expect(page.getByText('Recently sent')).toBeVisible()
})
```

- [ ] **Step 3: Run the e2e test**

Run: `npm run test:e2e -- touchpoints-admin`
Expected: PASS. (If admin auth isn't wired in Playwright yet, the verification fallback is the manual check in Step 4.)

- [ ] **Step 4: Manual smoke (always do this)**

`npm run dev` → log in as admin → visit `/admin/touchpoints`:
- Seeded row appears under **Needs sending** with Copy + Viber + WhatsApp + SMS + Call.
- Edit the draft, click **WhatsApp** → opens `wa.me` pre-filled with the edited text.
- Click **Mark sent** → row disappears, appears under **Recently sent** labelled "marked sent by …".
- In **Recently sent**, change status → "replied" persists on reload.
- **Send now** with a real booking code + type → row appears (chat) or "auto-emailed" message (email booking).
- `/admin/touchpoints/templates` → edit a body → Save → re-run the cron → new wording is used.

- [ ] **Step 5: Full build + suite + commit**

Run: `npm test && npm run build`
Expected: all unit tests pass; build exits 0.
```bash
git add e2e/touchpoints-admin.spec.ts
git commit -m "test(admin): touchpoints queue e2e"
```

---

## Definition of Done (Part 2)

- `/admin/touchpoints` lists pending chat touchpoints with editable drafts, Copy + Viber/Messenger/WhatsApp/SMS/Call (gated by contact info), and Mark sent.
- Recently-sent log shows auto-emails + manual chats, with a working replied/no-response status dropdown; chat sends labelled "marked sent by <staff>".
- Manual early-send by booking code creates (and for email, sends) a touchpoint immediately.
- Template editor saves wording; subsequent cron runs render the new copy.
- Touchpoints tile is live on the admin hub.
- `npx tsc --noEmit`, `npm test`, and `npm run build` all pass.

**Later (optional, not in this plan):** AI "✨ Suggest" button — server action calling Claude behind `checkAiBudget('admin', …)` + `sanitizeForPrompt`, needs `ANTHROPIC_API_KEY`. Additive to `SendRow` and `TemplateForm`.
```
