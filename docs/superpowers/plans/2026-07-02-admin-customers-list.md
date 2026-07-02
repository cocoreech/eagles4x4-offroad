# Admin Customers List + Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** An admin `/admin/customers` roster of all customer sign-ups with CSV (Excel) and print-to-PDF export.

**Architecture:** RSC page loads customer profiles + booking counts; a pure `toCustomersCsv` serializer feeds a client export bar (CSV Blob download + `window.print()`); print styles show only the table.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-07-02-admin-customers-list-design.md](../specs/2026-07-02-admin-customers-list-design.md).

## Global Constraints

- **TS strict — no `any`/`as unknown`.**
- **No new dependencies.**
- Admin-only (`requireAdmin`); read-only.
- CSV is RFC-4180 escaped; rows joined with `\r\n`.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/admin/customersCsv.ts` | Create — pure serializer |
| `src/lib/admin/customersCsv.test.ts` | Create — tests |
| `src/app/admin/customers/CustomerExportBar.tsx` | Create — client export bar |
| `src/app/admin/customers/page.tsx` | Create — list page |
| `src/app/admin/page.tsx` | Modify — wire the Customers tile |

---

## Task 1: CSV serializer (pure, TDD)

**Files:** Create `src/lib/admin/customersCsv.ts`, `src/lib/admin/customersCsv.test.ts`

**Interfaces:** Produces `CustomerCsvRow` + `toCustomersCsv(rows): string`.

- [ ] **Step 1: Failing test** — `src/lib/admin/customersCsv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toCustomersCsv } from './customersCsv'

const row = { preferredName: 'JD', fullName: 'Juan Dela Cruz', email: 'j@x.com', phone: '+639171234567', joined: '2026-07-01', bookings: 3 }

describe('toCustomersCsv', () => {
  it('starts with the header row', () => {
    expect(toCustomersCsv([]).trim()).toBe('Preferred Name,Full Name,Email,Phone,Joined,Bookings')
  })
  it('serializes a row in column order', () => {
    const csv = toCustomersCsv([row])
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('JD,Juan Dela Cruz,j@x.com,+639171234567,2026-07-01,3')
  })
  it('quotes and escapes fields with commas or quotes', () => {
    const csv = toCustomersCsv([{ ...row, fullName: 'Cruz, Juan "JD"' }])
    expect(csv.split('\r\n')[1]).toContain('"Cruz, Juan ""JD"""')
  })
})
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/lib/admin/customersCsv.test.ts`.

- [ ] **Step 3: Implement** — `src/lib/admin/customersCsv.ts`:

```ts
export interface CustomerCsvRow {
  preferredName: string
  fullName: string
  email: string
  phone: string
  joined: string
  bookings: number
}

const HEADER = ['Preferred Name', 'Full Name', 'Email', 'Phone', 'Joined', 'Bookings']

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Serialize customer rows to RFC-4180 CSV (CRLF line endings). Pure. */
export function toCustomersCsv(rows: CustomerCsvRow[]): string {
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push(
      [r.preferredName, r.fullName, r.email, r.phone, r.joined, String(r.bookings)]
        .map(escapeField)
        .join(','),
    )
  }
  return lines.join('\r\n')
}
```

- [ ] **Step 4: Run → pass** (3 tests). **Commit** — `git add src/lib/admin/customersCsv.* && git commit -m "feat(admin): customers CSV serializer"`

---

## Task 2: Export bar (client)

**Files:** Create `src/app/admin/customers/CustomerExportBar.tsx`

**Interfaces:** Consumes `toCustomersCsv`, `CustomerCsvRow`. Props: `{ rows: CustomerCsvRow[] }`.

- [ ] **Step 1: Implement**

```tsx
'use client'

import { toCustomersCsv, type CustomerCsvRow } from '@/lib/admin/customersCsv'

export default function CustomerExportBar({ rows }: Readonly<{ rows: CustomerCsvRow[] }>) {
  function downloadCsv() {
    const csv = toCustomersCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const btn = 'rounded-sm px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em]'

  return (
    <div className="flex gap-3 print:hidden">
      <button type="button" onClick={downloadCsv} className={btn} style={{ background: 'var(--color-accent)', color: '#000' }}>
        Export CSV (Excel)
      </button>
      <button type="button" onClick={() => window.print()} className={btn} style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
        Save as PDF
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/customers/CustomerExportBar.tsx`. **Commit** — `feat(admin): customer export bar (CSV + print)`.

---

## Task 3: Customers page + tile

**Files:** Create `src/app/admin/customers/page.tsx`; Modify `src/app/admin/page.tsx`

- [ ] **Step 1: Page** — `src/app/admin/customers/page.tsx`:

```tsx
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { CustomerCsvRow } from '@/lib/admin/customersCsv'
import CustomerExportBar from './CustomerExportBar'

export const dynamic = 'force-dynamic'

export default async function AdminCustomersPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [profilesRes, bookingsRes] = await Promise.all([
    supabase.from('profiles')
      .select('id, preferred_name, full_name, email, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false }),
    supabase.from('bookings').select('customer_id'),
  ])

  const counts = new Map<string, number>()
  for (const b of bookingsRes.data ?? []) {
    if (b.customer_id) counts.set(b.customer_id, (counts.get(b.customer_id) ?? 0) + 1)
  }

  const rows: CustomerCsvRow[] = (profilesRes.data ?? []).map(p => ({
    preferredName: p.preferred_name ?? '',
    fullName: p.full_name ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    joined: String(p.created_at).slice(0, 10),
    bookings: counts.get(p.id) ?? 0,
  }))

  const th = 'text-left p-3 text-[10px] font-bold tracking-widest uppercase'
  const muted = { color: 'var(--color-text-muted)' }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>Customers</h1>
        <Link href="/admin" className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>← Admin</Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs" style={muted}>{rows.length} customer{rows.length === 1 ? '' : 's'}</p>
        <CustomerExportBar rows={rows} />
      </div>

      <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
            <tr>
              <th className={th} style={muted}>Preferred</th>
              <th className={th} style={muted}>Full name</th>
              <th className={th} style={muted}>Email</th>
              <th className={th} style={muted}>Phone</th>
              <th className={th} style={muted}>Joined</th>
              <th className={th} style={muted}>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center" style={muted}>No customers yet.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.preferredName || '—'}</td>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.fullName || '—'}</td>
                <td className="p-3" style={muted}>{r.email || '—'}</td>
                <td className="p-3" style={muted}>{r.phone || '—'}</td>
                <td className="p-3" style={muted}>{r.joined}</td>
                <td className="p-3" style={{ color: 'var(--color-accent)' }}>{r.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Wire the tile** — in `src/app/admin/page.tsx`, change the Customers tile:

```tsx
            <Tile
              href="/admin/customers"
              title="Customers"
              desc="Everyone who signed up · export CSV/PDF"
              count="View"
              ready
            />
```
(Replace the existing `href="#" ... comingSoon` Customers tile.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/customers src/app/admin/page.tsx`. **Commit** — `feat(admin): customers list page + hub tile`.

---

## Task 4: Verification

- [ ] `npm run test` → green incl. `customersCsv.test.ts` (3).
- [ ] `npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] Runtime: `/admin/customers` lists customers + booking counts; Export CSV downloads and opens in Excel; Save as PDF prints only the table.
- [ ] `git push origin feat/touchpoints`.

---

## Self-Review

**Spec coverage:** §3 data — T3 ✓; §4 serializer — T1 ✓; §5 components — T2/T3 ✓; §6 security — T3 ✓; §7 tests — T1/T4 ✓.
**Placeholder scan:** all code complete.
**Type consistency:** `CustomerCsvRow` from T1 is used by T2 + T3 identically; page maps DB rows to that exact shape.
```
