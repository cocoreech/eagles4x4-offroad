# Services Smart-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Let admins delete a service — hard-delete when it has no booking history, soft-delete (deactivate) when it's referenced by past bookings.

**Architecture:** A pure `deleteMode(isReferenced)` decides soft vs hard; `deleteService` does the `booking_items` reference check and applies delete-or-deactivate; a `DeleteServiceButton` (confirm + result) sits beside the existing toggle in the services list.

**Tech Stack:** Next.js 16 App Router (server action + client button), TypeScript, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-02-services-smart-delete-design.md](../specs/2026-07-02-services-smart-delete-design.md).

## Global Constraints

- **TypeScript strict — no `any`, no `as unknown`.**
- **Reuse existing guards:** `requireAdmin` + `adminRateGuard` + `z.string().uuid()` (as in `deactivateService`).
- **Never throw:** actions return `{ error }` on failure.
- **Hard-delete only when the reference check finds none** — cannot orphan `booking_items`.

---

## File Structure

| File | Change |
|---|---|
| `src/lib/services/deleteDecision.ts` | Create — pure `deleteMode` |
| `src/lib/services/deleteDecision.test.ts` | Create — unit test |
| `src/app/admin/services/actions.ts` | Modify — `deleteService` action |
| `src/app/admin/services/DeleteServiceButton.tsx` | Create — confirm + call + result |
| `src/app/admin/services/page.tsx` | Modify — render the button in the row |

---

## Task 1: `deleteMode` helper (pure, TDD)

**Files:** Create `src/lib/services/deleteDecision.ts`, `src/lib/services/deleteDecision.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/services/deleteDecision.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deleteMode } from './deleteDecision'

describe('deleteMode', () => {
  it('soft-deletes a referenced service', () => {
    expect(deleteMode(true)).toBe('soft')
  })
  it('hard-deletes an unreferenced service', () => {
    expect(deleteMode(false)).toBe('hard')
  })
})
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/services/deleteDecision.test.ts` (module missing).

- [ ] **Step 3: Implement** — `src/lib/services/deleteDecision.ts`:

```ts
/** A referenced service is hidden (soft) to preserve booking history; else removed (hard). */
export function deleteMode(isReferenced: boolean): 'soft' | 'hard' {
  return isReferenced ? 'soft' : 'hard'
}
```

- [ ] **Step 4: Run → pass** — `npx vitest run src/lib/services/deleteDecision.test.ts` (2 pass).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/deleteDecision.ts src/lib/services/deleteDecision.test.ts
git commit -m "feat(admin): service delete-mode decision helper"
```

---

## Task 2: `deleteService` action

**Files:** Modify `src/app/admin/services/actions.ts`

**Interfaces:**
- Consumes: `deleteMode` (Task 1); existing `requireAdmin`, `adminRateGuard`, `createClient`, `z`.
- Produces: `deleteService(formData: FormData): Promise<{ error?: string; success?: boolean; softened?: boolean }>`

- [ ] **Step 1: Add the import**

At the top of `src/app/admin/services/actions.ts`:

```ts
import { deleteMode } from '@/lib/services/deleteDecision'
```

- [ ] **Step 2: Add the action** (after `deactivateService`):

```ts
// Smart-delete: remove services with no booking history; deactivate those
// referenced by past bookings (booking_items.service_id) to preserve records.
export async function deleteService(formData: FormData): Promise<{ error?: string; success?: boolean; softened?: boolean }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid service id.' }

  const supabase = await createClient()

  const { data: ref, error: refErr } = await supabase
    .from('booking_items')
    .select('id')
    .eq('service_id', id)
    .limit(1)
    .maybeSingle()
  if (refErr) {
    console.error('[deleteService] ref check', refErr)
    return { error: 'Could not delete the service.' }
  }

  const mode = deleteMode(ref !== null)
  if (mode === 'soft') {
    const { error } = await supabase.from('services').update({ is_active: false }).eq('id', id)
    if (error) return { error: 'Could not delete the service.' }
    revalidatePath('/admin/services')
    revalidatePath('/services')
    return { success: true, softened: true }
  }

  const { error } = await supabase.from('services').delete().eq('id', id)
  if (error) return { error: 'Could not delete the service.' }
  revalidatePath('/admin/services')
  revalidatePath('/services')
  return { success: true, softened: false }
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/services/actions.ts` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/services/actions.ts
git commit -m "feat(admin): deleteService smart-delete action"
```

---

## Task 3: `DeleteServiceButton` + wire into the list

**Files:** Create `src/app/admin/services/DeleteServiceButton.tsx`; Modify `src/app/admin/services/page.tsx`

- [ ] **Step 1: Create the button** — `src/app/admin/services/DeleteServiceButton.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { deleteService } from './actions'

export default function DeleteServiceButton({ id, name }: Readonly<{ id: string; name: string }>) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? Services with past bookings will be hidden instead of removed.`)) return
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deleteService(fd)
      if (res.error) setMsg(res.error)
      else if (res.softened) setMsg('Hidden (has past bookings)')
      // hard-delete: the row disappears on revalidate; no message needed
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-xs font-bold tracking-widest uppercase disabled:opacity-50"
        style={{ color: 'var(--color-destructive)' }}
      >
        {pending ? '…' : 'Delete'}
      </button>
      {msg && <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{msg}</span>}
    </span>
  )
}
```

- [ ] **Step 2: Wire into the list** — in `src/app/admin/services/page.tsx`, add the import:

```tsx
import DeleteServiceButton from './DeleteServiceButton'
```

and in the last cell (the one containing `Edit →`), add the button after the Edit link:

```tsx
                        <Link href={`/admin/services/${s.id}`} className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                          Edit →
                        </Link>
                        <span className="ml-3">
                          <DeleteServiceButton id={s.id} name={s.name} />
                        </span>
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint src/app/admin/services` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/services/DeleteServiceButton.tsx src/app/admin/services/page.tsx
git commit -m "feat(admin): delete button in services list (smart-delete)"
```

---

## Task 4: Verification

- [ ] **Step 1: Full suite** — `npm run test` → all green incl. `deleteDecision.test.ts` (2).
- [ ] **Step 2: tsc + lint + build** — `npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] **Step 3: Runtime** — delete an unused service → row removed; delete a service that has a past booking → it deactivates with the "Hidden (has past bookings)" note and drops off the public `/services` list.
- [ ] **Step 4: Push** — `git push origin feat/touchpoints`.

---

## Self-Review

**Spec coverage:** §3 behavior — Tasks 1–2 ✓; §4 components (helper/action/button) — Tasks 1–3 ✓; §5 guards + safe hard-delete — Task 2 ✓; §6 tests — Tasks 1, 4 ✓.
**Placeholder scan:** none — all code complete.
**Type consistency:** `deleteMode(isReferenced: boolean)` defined in Task 1, called in Task 2; `deleteService` return shape matches the button's use in Task 3.
```
