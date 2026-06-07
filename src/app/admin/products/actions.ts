'use server'

// ============================================================
// Admin Products CRUD actions
// ============================================================
// Same hardening as Services:
//   - requireAdmin() at every entry point
//   - All free text sanitized via sanitizeText/sanitizeMultiline
//   - Slug forced to safe characters
//   - Category from enum allow-list
//   - Brand free-text but length-capped and char-restricted
//   - Image URL comes from our ImageUpload component (server-controlled path)
//   - Soft-delete only (is_active=false) — never hard-delete; would break
//     historical bookings_items.name_snapshot / price_snapshot references

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}
async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `products-action:${userId}:${getIp()}`)
  return result.allowed
}

const PRODUCT_CATEGORIES = ['suspension','wheels-tires','recovery','lighting','protection'] as const

const productSchema = z.object({
  slug: z.string().transform(s => sanitizeText(s, 60))
          .refine(v => /^[a-z0-9-]+$/.test(v), 'Slug: lowercase letters, numbers, and dashes only.'),
  name: z.string().transform(s => sanitizeText(s, 120))
          .refine(v => v.length > 0, 'Name is required.'),
  brand: z.string().transform(s => sanitizeText(s, 60))
          .refine(v => v.length === 0 || /^[a-zA-Z0-9 .&\-'/]+$/.test(v), 'Brand contains invalid characters.')
          .optional(),
  description: z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  price:    z.coerce.number().min(0).max(10_000_000),
  stock:    z.coerce.number().int().min(0).max(100_000),
  imageUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.preprocess(v => v === 'true' || v === true || v === 'on', z.boolean()),
})

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    slug:        formData.get('slug'),
    name:        formData.get('name'),
    brand:       formData.get('brand') ?? '',
    description: formData.get('description') ?? '',
    category:    formData.get('category'),
    price:       formData.get('price'),
    stock:       formData.get('stock') ?? 0,
    imageUrl:    formData.get('imageUrl') ?? '',
    isActive:    formData.get('isActive') ?? 'false',
  })
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createProduct(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const parsed = parseProduct(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('products').insert({
    slug:        d.slug,
    name:        d.name,
    brand:       d.brand || null,
    description: d.description || null,
    category:    d.category,
    price:       d.price,
    stock:       d.stock,
    image_url:   d.imageUrl || null,
    is_active:   d.isActive,
  })

  if (error) {
    console.error('[createProduct]', error)
    return { error: error.code === '23505' ? 'A product with this slug already exists.' : 'Could not save product.' }
  }

  revalidatePath('/admin/products')
  redirect('/admin/products?created=1')
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateProduct(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid product id.' }
  const parsed = parseProduct(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('products').update({
    slug:        d.slug,
    name:        d.name,
    brand:       d.brand || null,
    description: d.description || null,
    category:    d.category,
    price:       d.price,
    stock:       d.stock,
    image_url:   d.imageUrl || null,
    is_active:   d.isActive,
  }).eq('id', id)

  if (error) {
    console.error('[updateProduct]', error)
    return { error: 'Could not save changes.' }
  }

  revalidatePath('/admin/products')
  revalidatePath(`/admin/products/${id}`)
  redirect('/admin/products?updated=1')
}

// ─────────────────────────────────────────────
// SOFT DELETE (toggle is_active)
// ─────────────────────────────────────────────
export async function deactivateProduct(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid product id.' }
  const supabase = createClient()
  const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
  if (error) return { error: 'Could not deactivate.' }
  revalidatePath('/admin/products')
  return { success: true }
}

export async function activateProduct(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid product id.' }
  const supabase = createClient()
  const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id)
  if (error) return { error: 'Could not activate.' }
  revalidatePath('/admin/products')
  return { success: true }
}

// ─────────────────────────────────────────────
// SET / CLEAR IMAGE (inline from product list)
// Defense-in-depth: URL must belong to OUR Supabase storage bucket —
// prevents an attacker from setting a malicious external URL via API.
// ─────────────────────────────────────────────
const imageUpdateSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable().optional()
    .refine(v =>
      v == null || v === '' ||
      v.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`),
      'Image URL must be from Eagles 4x4 storage.'
    ),
})

export async function setProductImage(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const parsed = imageUpdateSchema.safeParse({
    id:       formData.get('id'),
    imageUrl: formData.get('imageUrl') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = createClient()
  const { error } = await supabase
    .from('products')
    .update({ image_url: parsed.data.imageUrl || null })
    .eq('id', parsed.data.id)

  if (error) return { error: 'Could not save image.' }
  revalidatePath('/admin/products')
  return { success: true }
}
