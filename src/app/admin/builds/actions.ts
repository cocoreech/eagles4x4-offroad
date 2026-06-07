'use server'

// ============================================================
// Admin Builds CRUD actions
// ============================================================
// Same hardening pattern as Services + Products + Bulk:
//   - requireAdmin() at entry
//   - adminRateGuard per action
//   - All free text sanitized
//   - Image URLs validated to come from our Supabase storage only
//   - Multi-image gallery stored as text[] of validated URLs

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
  const result = await checkLimit(rlAdminGeneral, `builds-action:${userId}:${getIp()}`)
  return result.allowed
}

// Image URLs must come from OUR storage — same defense as products/services
const storageUrlPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`
const ourStorageUrl = z.string().url().refine(
  v => v.startsWith(storageUrlPrefix),
  'Image URL must be from Eagles 4x4 storage.'
)

const buildSchema = z.object({
  slug: z.string().transform(s => sanitizeText(s, 80))
    .refine(v => /^[a-z0-9-]+$/.test(v), 'Slug: lowercase letters, numbers, and dashes only.'),
  title: z.string().transform(s => sanitizeText(s, 150))
    .refine(v => v.length > 0, 'Title is required.'),
  vehicleMake:  z.string().transform(s => sanitizeText(s, 60))
    .refine(v => v.length > 0 && /^[a-zA-Z0-9 .&\-'/]+$/.test(v), 'Vehicle make required.'),
  vehicleModel: z.string().transform(s => sanitizeText(s, 60))
    .refine(v => v.length > 0 && /^[a-zA-Z0-9 .&\-'/]+$/.test(v), 'Vehicle model required.'),
  vehicleYear: z.coerce.number().int().min(1970).max(new Date().getFullYear() + 1).optional(),
  location:    z.string().transform(s => sanitizeText(s, 100)).optional(),
  description: z.string().transform(s => sanitizeMultiline(s, 4000)).optional(),
  buildDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional().or(z.literal('')),
  durationDays: z.coerce.number().int().min(0).max(365).optional(),
  isFeatured:  z.preprocess(v => v === 'true' || v === true || v === 'on', z.boolean()).optional(),
  coverImageUrl: ourStorageUrl.optional().or(z.literal('')),
  galleryUrls: z.string().transform(raw => {
    // Stored as JSON array string in the form
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Filter to only our storage URLs (silently drop anything weird)
      return parsed
        .filter(u => typeof u === 'string' && u.startsWith(storageUrlPrefix))
        .slice(0, 30)  // cap at 30 photos per build
    } catch {
      return []
    }
  }),
  tagsRaw: z.string().transform(s => {
    // Comma-separated input → array of clean tag strings
    return s.split(',')
      .map(t => sanitizeText(t, 30))
      .filter(t => t.length > 0 && /^[a-zA-Z0-9 .&\-'/]+$/.test(t))
      .slice(0, 12)
  }),
})

function parseBuild(formData: FormData) {
  return buildSchema.safeParse({
    slug:          formData.get('slug'),
    title:         formData.get('title'),
    vehicleMake:   formData.get('vehicleMake'),
    vehicleModel:  formData.get('vehicleModel'),
    vehicleYear:   formData.get('vehicleYear') || undefined,
    location:      formData.get('location') ?? '',
    description:   formData.get('description') ?? '',
    buildDate:     formData.get('buildDate') ?? '',
    durationDays:  formData.get('durationDays') || undefined,
    isFeatured:    formData.get('isFeatured') ?? 'false',
    coverImageUrl: formData.get('coverImageUrl') ?? '',
    galleryUrls:   formData.get('galleryUrls') ?? '[]',
    tagsRaw:       formData.get('tags') ?? '',
  })
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createBuild(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }

  const parsed = parseBuild(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('builds').insert({
    slug:               d.slug,
    title:              d.title,
    vehicle_make:       d.vehicleMake,
    vehicle_model:      d.vehicleModel,
    vehicle_year:       d.vehicleYear ?? null,
    location:           d.location || null,
    description:        d.description || null,
    build_date:         d.buildDate || null,
    duration_days:      d.durationDays ?? null,
    is_featured:        d.isFeatured ?? false,
    cover_image_url:    d.coverImageUrl || null,
    gallery_image_urls: d.galleryUrls,
    tags:               d.tagsRaw,
  })

  if (error) {
    console.error('[createBuild]', error)
    return { error: error.code === '23505' ? 'A build with this slug already exists.' : 'Could not save build.' }
  }

  revalidatePath('/admin/builds')
  revalidatePath('/')
  revalidatePath('/builds')
  redirect('/admin/builds?created=1')
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateBuild(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }

  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid build id.' }
  const parsed = parseBuild(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = createClient()
  const { error } = await supabase.from('builds').update({
    slug:               d.slug,
    title:              d.title,
    vehicle_make:       d.vehicleMake,
    vehicle_model:      d.vehicleModel,
    vehicle_year:       d.vehicleYear ?? null,
    location:           d.location || null,
    description:        d.description || null,
    build_date:         d.buildDate || null,
    duration_days:      d.durationDays ?? null,
    is_featured:        d.isFeatured ?? false,
    cover_image_url:    d.coverImageUrl || null,
    gallery_image_urls: d.galleryUrls,
    tags:               d.tagsRaw,
  }).eq('id', id)

  if (error) {
    console.error('[updateBuild]', error)
    return { error: 'Could not save changes.' }
  }

  revalidatePath('/admin/builds')
  revalidatePath(`/admin/builds/${id}`)
  revalidatePath('/')
  revalidatePath('/builds')
  redirect('/admin/builds?updated=1')
}

// ─────────────────────────────────────────────
// DELETE (hard delete — builds aren't referenced by booking_items)
// ─────────────────────────────────────────────
export async function deleteBuild(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }

  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid build id.' }

  const supabase = createClient()
  const { error } = await supabase.from('builds').delete().eq('id', id)
  if (error) return { error: 'Could not delete.' }

  revalidatePath('/admin/builds')
  revalidatePath('/')
  revalidatePath('/builds')
  return { success: true }
}

// ─────────────────────────────────────────────
// Toggle featured (inline from list)
// ─────────────────────────────────────────────
const featuredSchema = z.object({
  id: z.string().uuid(),
  isFeatured: z.boolean(),
})

export async function setFeatured(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }

  const parsed = featuredSchema.safeParse({
    id: formData.get('id'),
    isFeatured: formData.get('isFeatured') === 'true',
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const supabase = createClient()
  const { error } = await supabase
    .from('builds')
    .update({ is_featured: parsed.data.isFeatured })
    .eq('id', parsed.data.id)
  if (error) return { error: 'Could not update.' }
  revalidatePath('/admin/builds')
  revalidatePath('/')
  return { success: true }
}
