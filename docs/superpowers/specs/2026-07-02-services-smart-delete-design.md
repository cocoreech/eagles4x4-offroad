# Services Smart-Delete (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** `src/app/admin/services/actions.ts`, `src/app/admin/services/page.tsx`, `src/app/admin/services/ToggleActiveButton.tsx`

## 1. Summary

Give admins a **Delete** for services. Because `booking_items` reference `services.id` (and snapshot the name), deletion is **smart**: a service with **no** booking history is **hard-deleted** (row removed); a service that **is** referenced by any booking is **soft-deleted** (deactivated + hidden), preserving records. This is the only remaining gap in the "products image upload + services add/delete" batch — products image upload and services add/image/deactivate already exist.

## 2. Scope

**In scope:**
- One `deleteService` server action implementing the smart branch.
- A `DeleteServiceButton` in the admin services UI (confirm + result message), beside the existing activate/deactivate toggle.
- A tiny pure decision helper for the soft-vs-hard branch, unit-tested.

**Out of scope / already done (YAGNI):**
- **#1 Products image upload** — already fully wired (`ImageUpload` in the product form, `InlineImageCell` + `setProductImage` in the list). Nothing to build.
- Services add / image upload / deactivate — already exist.
- Cascading behavior changes to `booking_items` or its FK — untouched; smart-delete avoids the problem by checking references first.
- Product delete — not requested here.

## 3. Behavior

`deleteService(formData)` (admin-only, rate-guarded, UUID-validated — same guards as `deactivateService`):

1. Query whether any `booking_items` row has `service_id = <id>` (existence check, `limit 1`).
2. **Referenced** → update `services.is_active = false`; return `{ success: true, softened: true }` so the UI can say *"This service has past bookings, so it was hidden instead of permanently deleted."*
3. **Not referenced** → delete the `services` row; return `{ success: true, softened: false }`.
4. `revalidatePath('/admin/services')`.

Errors return `{ error }` (never throw), matching the sibling actions.

## 4. Components

- **`src/lib/services/deleteDecision.ts`** — pure `deleteMode(isReferenced: boolean): 'soft' | 'hard'` (`isReferenced ? 'soft' : 'hard'`). Trivial but isolates + documents the rule and is unit-tested.
- **`deleteService`** in `src/app/admin/services/actions.ts` — does the reference check, calls `deleteMode`, applies the update-or-delete.
- **`src/app/admin/services/DeleteServiceButton.tsx`** — `"use client"`; a confirm dialog (`window.confirm`) then calls `deleteService`; renders the returned message (removed vs hidden) or error. Placed in the services list row next to `ToggleActiveButton`.

Boundaries: the decision helper is pure/tested; the action owns the DB reference check + mutation; the button owns confirm + result display. Mirrors the existing `ToggleActiveButton` pattern.

## 5. Security

Reuses `requireAdmin` + `adminRateGuard` + `z.string().uuid()` validation exactly as the neighboring service actions. Hard-delete only runs when the reference check returns none, so it can't orphan `booking_items`.

## 6. Testing

- **Unit (TDD):** `deleteMode` — `true → 'soft'`, `false → 'hard'`.
- **Runtime:** delete an unused service → row gone; attempt to delete a service that has a past booking → it deactivates instead, with the "hidden instead of deleted" message; the public `/services` list no longer shows either.

## 7. Build order

1. `deleteMode` helper + test (pure).
2. `deleteService` action (reference check + branch).
3. `DeleteServiceButton` + wire into the services list.
4. Verify.
```
