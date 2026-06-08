'use server'

// ============================================================
// Bulk insert products from the admin bulk-import form
// ============================================================
// SECURITY:
//   - requireAdmin() at entry
//   - Each row validated with the SAME schema as single-add (no shortcuts)
//   - If ANY row fails, the whole batch is rejected with row-specific errors
//   - Duplicate slugs within the batch are rejected
//   - Postgres unique constraint catches duplicates against existing rows

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const PRODUCT_CATEGORIES = ['suspension','wheels-tires','recovery','lighting','protection'] as const

// Single-row schema — IDENTICAL hardening to the single-add product schema
const rowSchema = z.object({
  slug: z.string().transform(s => sanitizeText(s, 60))
          .refine(v => /^[a-z0-9-]+$/.test(v), 'Slug: lowercase letters, numbers, dashes only.'),
  name: z.string().transform(s => sanitizeText(s, 120))
          .refine(v => v.length > 0, 'Name required'),
  brand: z.string().transform(s => sanitizeText(s, 60))
          .refine(v => v.length === 0 || /^[a-zA-Z0-9 .&\-'/]+$/.test(v), 'Brand contains invalid characters')
          .optional(),
  description: z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  price:    z.coerce.number().min(0).max(10_000_000),
  stock:    z.coerce.number().int().min(0).max(100_000),
})

const MAX_ROWS = 100  // safety: prevent massive payloads

export async function bulkCreateProducts(formData: FormData) {
  const { user } = await requireAdmin()

  // Rate-limit per admin — bulk imports are expensive, don't let
  // a runaway/compromised admin script hammer this.
  const rl = await checkLimit(rlAdminGeneral, `bulk-products:${user.id}:${await getIp()}`)
  if (!rl.allowed) {
    return { error: 'Too many bulk imports. Please wait a few minutes.' }
  }

  // The client posts a JSON-encoded array of rows under 'rows'
  const rowsJson = String(formData.get('rows') ?? '[]')
  let rawRows: unknown
  try {
    rawRows = JSON.parse(rowsJson)
  } catch {
    return { error: 'Bad payload. Please reload and try again.' }
  }
  if (!Array.isArray(rawRows)) return { error: 'Bad payload format.' }
  if (rawRows.length === 0)    return { error: 'Add at least one row before saving.' }
  if (rawRows.length > MAX_ROWS) return { error: `Maximum ${MAX_ROWS} rows per import.` }

  // Validate every row, collect errors with row indices
  const validRows: z.infer<typeof rowSchema>[] = []
  const errors: { row: number; message: string }[] = []
  const seenSlugs = new Set<string>()

  rawRows.forEach((raw, i) => {
    const parsed = rowSchema.safeParse(raw)
    if (!parsed.success) {
      errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? 'Invalid row' })
      return
    }
    if (seenSlugs.has(parsed.data.slug)) {
      errors.push({ row: i + 1, message: `Duplicate slug "${parsed.data.slug}" within this import` })
      return
    }
    seenSlugs.add(parsed.data.slug)
    validRows.push(parsed.data)
  })

  if (errors.length > 0) {
    return {
      error: `Found issues in ${errors.length} row(s). Fix and try again.`,
      rowErrors: errors,
    }
  }

  // Insert all in one go (transaction). image_url left null — admin adds individually.
  const supabase = await createClient()
  const payload = validRows.map(r => ({
    slug:        r.slug,
    name:        r.name,
    brand:       r.brand || null,
    description: r.description || null,
    category:    r.category,
    price:       r.price,
    stock:       r.stock,
    image_url:   null,
    is_active:   true,
  }))

  const { error } = await supabase.from('products').insert(payload)

  if (error) {
    console.error('[bulkCreateProducts]', error)
    if (error.code === '23505') {
      return { error: 'One or more slugs already exist in the database. Please rename and retry.' }
    }
    return { error: 'Could not save products. Please try again.' }
  }

  revalidatePath('/admin/products')
  redirect(`/admin/products?bulkCreated=${validRows.length}`)
}
