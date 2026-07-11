'use server'

// ============================================================
// Admin Services CRUD actions
// ============================================================
// All write paths require admin role (requireAdmin + RLS doubles).
// Free-text fields go through sanitizeText.

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'
import { deleteMode } from '@/lib/services/deleteDecision'
import { shouldNotifyCatalogPublish } from '@/lib/notifications/catalogPublish'
import { notifyCatalogPublish } from '@/lib/notifications/publishCatalogItem'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}
async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `services-action:${userId}:${await getIp()}`)
  return result.allowed
}

// Best-effort — a notification failure never blocks saving the service.
async function notifyCustomersOfService(service: { name: string; description: string | null }) {
  const admin = createServiceRoleClient()
  await notifyCatalogPublish(admin, {
    kind: 'Service',
    title: service.name,
    description: service.description,
    path: '/services',
  })
}

const SERVICE_CATEGORIES = ['suspension','protection','recovery','lighting','full-builds','accessories'] as const

const serviceSchema = z.object({
  slug:           z.string().transform(s => sanitizeText(s, 60))
                    .refine(v => /^[a-z0-9-]+$/.test(v), 'Slug: lowercase letters, numbers, and dashes only.'),
  name:           z.string().transform(s => sanitizeText(s, 100))
                    .refine(v => v.length > 0, 'Name is required.'),
  description:    z.string().transform(s => sanitizeMultiline(s, 500)).optional(),
  category:       z.enum(SERVICE_CATEGORIES),
  icon:           z.string().transform(s => sanitizeText(s, 8)).optional(),
  startingPrice:  z.coerce.number().min(0).max(10_000_000),
  durationHours:  z.coerce.number().min(0).max(500).optional(),
  imageUrl:       z.string().url().optional().or(z.literal('')),
  isActive:       z.preprocess(v => v === 'true' || v === true || v === 'on', z.boolean()),
  displayOrder:   z.coerce.number().int().min(0).max(9999).optional(),
})

function parseService(formData: FormData) {
  return serviceSchema.safeParse({
    slug:          formData.get('slug'),
    name:          formData.get('name'),
    description:   formData.get('description') ?? '',
    category:      formData.get('category'),
    icon:          formData.get('icon') ?? '',
    startingPrice: formData.get('startingPrice'),
    durationHours: formData.get('durationHours') ?? 0,
    imageUrl:      formData.get('imageUrl') ?? '',
    isActive:      formData.get('isActive') ?? 'false',
    displayOrder:  formData.get('displayOrder') ?? 0,
  })
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createService(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const parsed = parseService(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('services').insert({
    slug:           d.slug,
    name:           d.name,
    description:    d.description || null,
    category:       d.category,
    icon:           d.icon || null,
    starting_price: d.startingPrice,
    duration_hours: d.durationHours ?? null,
    image_url:      d.imageUrl || null,
    is_active:      d.isActive,
    display_order:  d.displayOrder ?? 0,
  })

  if (error) {
    console.error('[createService]', error)
    return { error: error.code === '23505' ? 'A service with this slug already exists.' : 'Could not save service.' }
  }

  if (shouldNotifyCatalogPublish(d.isActive, false)) {
    await notifyCustomersOfService({ name: d.name, description: d.description || null })
  }

  revalidatePath('/admin/services')
  redirect('/admin/services?created=1')
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateService(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid service id.' }
  const parsed = parseService(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const d = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase.from('services').select('is_active').eq('id', id).maybeSingle()
  const { error } = await supabase.from('services').update({
    slug:           d.slug,
    name:           d.name,
    description:    d.description || null,
    category:       d.category,
    icon:           d.icon || null,
    starting_price: d.startingPrice,
    duration_hours: d.durationHours ?? null,
    image_url:      d.imageUrl || null,
    is_active:      d.isActive,
    display_order:  d.displayOrder ?? 0,
  }).eq('id', id)

  if (error) {
    console.error('[updateService]', error)
    return { error: 'Could not save changes.' }
  }

  if (existing && shouldNotifyCatalogPublish(d.isActive, existing.is_active)) {
    await notifyCustomersOfService({ name: d.name, description: d.description || null })
  }

  revalidatePath('/admin/services')
  revalidatePath(`/admin/services/${id}`)
  redirect('/admin/services?updated=1')
}

// ─────────────────────────────────────────────
// SOFT DELETE (toggle is_active off)
// We never hard-delete because booking_items reference services.id
// ─────────────────────────────────────────────
export async function deactivateService(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid service id.' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').update({ is_active: false }).eq('id', id)
  if (error) return { error: 'Could not deactivate.' }
  revalidatePath('/admin/services')
  return { success: true }
}

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

export async function activateService(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid service id.' }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('services').select('name, description, is_active').eq('id', id).maybeSingle()
  const { error } = await supabase.from('services').update({ is_active: true }).eq('id', id)
  if (error) return { error: 'Could not activate.' }
  if (existing && shouldNotifyCatalogPublish(true, existing.is_active)) {
    await notifyCustomersOfService({ name: existing.name, description: existing.description })
  }
  revalidatePath('/admin/services')
  return { success: true }
}

// Inline image set/clear from list — see products/actions.ts for details
const serviceImageSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable().optional()
    .refine(v =>
      v == null || v === '' ||
      v.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`),
      'Image URL must be from Eagles 4x4 storage.'
    ),
})

export async function setServiceImage(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const parsed = serviceImageSchema.safeParse({
    id:       formData.get('id'),
    imageUrl: formData.get('imageUrl') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ image_url: parsed.data.imageUrl || null })
    .eq('id', parsed.data.id)

  if (error) return { error: 'Could not save image.' }
  revalidatePath('/admin/services')
  return { success: true }
}
