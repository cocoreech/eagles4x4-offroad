'use server'

// ============================================================
// Admin Events CRUD actions
// ============================================================

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

async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `events-action:${userId}:${await getIp()}`)
  return result.allowed
}

const EVENT_TYPES = ['trail_ride', 'product_launch', 'promo', 'meetup', 'workshop'] as const

const eventSchema = z.object({
  slug:        z.string().transform(s => sanitizeText(s, 80))
                 .refine(v => /^[a-z0-9-]+$/.test(v), 'Slug: lowercase letters, numbers, and dashes only.'),
  title:       z.string().transform(s => sanitizeText(s, 120))
                 .refine(v => v.length > 0, 'Title is required.'),
  description: z.string().transform(s => sanitizeMultiline(s, 1000)).optional(),
  event_type:  z.enum(EVENT_TYPES).optional().or(z.literal('')),
  starts_at:   z.string().min(1, 'Start date/time is required.'),
  ends_at:     z.string().optional().or(z.literal('')),
  location:    z.string().transform(s => sanitizeText(s, 200)).optional(),
  difficulty:  z.string().transform(s => sanitizeText(s, 50)).optional(),
  cover_image_url: z.string().url().optional().or(z.literal('')),
  is_published: z.preprocess(v => v === 'true' || v === true || v === 'on', z.boolean()),
})

function parseEvent(formData: FormData) {
  return eventSchema.safeParse({
    slug:            formData.get('slug'),
    title:           formData.get('title'),
    description:     formData.get('description') ?? '',
    event_type:      formData.get('event_type') ?? '',
    starts_at:       formData.get('starts_at'),
    ends_at:         formData.get('ends_at') ?? '',
    location:        formData.get('location') ?? '',
    difficulty:      formData.get('difficulty') ?? '',
    cover_image_url: formData.get('cover_image_url') ?? '',
    is_published:    formData.get('is_published') ?? 'false',
  })
}

// ─────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────
export async function createEvent(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const parsed = parseEvent(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.from('events').insert({
    slug:            d.slug,
    title:           d.title,
    description:     d.description || null,
    event_type:      d.event_type || null,
    starts_at:       d.starts_at,
    ends_at:         d.ends_at || null,
    location:        d.location || null,
    difficulty:      d.difficulty || null,
    cover_image_url: d.cover_image_url || null,
    is_published:    d.is_published,
  })

  if (error) {
    console.error('[createEvent]', error)
    return { error: error.code === '23505' ? 'An event with this slug already exists.' : 'Could not save event.' }
  }

  revalidatePath('/admin/events')
  revalidatePath('/events')
  redirect('/admin/events?created=1')
}

// ─────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────
export async function updateEvent(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid event id.' }
  const parsed = parseEvent(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const d = parsed.data

  const supabase = await createClient()
  const { data: existing } = await supabase.from('events').select('slug').eq('id', id).maybeSingle()
  const { error } = await supabase.from('events').update({
    slug:            d.slug,
    title:           d.title,
    description:     d.description || null,
    event_type:      d.event_type || null,
    starts_at:       d.starts_at,
    ends_at:         d.ends_at || null,
    location:        d.location || null,
    difficulty:      d.difficulty || null,
    cover_image_url: d.cover_image_url || null,
    is_published:    d.is_published,
  }).eq('id', id)

  if (error) {
    console.error('[updateEvent]', error)
    return { error: 'Could not save changes.' }
  }

  revalidatePath('/admin/events')
  revalidatePath(`/admin/events/${id}`)
  revalidatePath('/events')
  if (existing?.slug) revalidatePath(`/events/${existing.slug}`)
  redirect('/admin/events?updated=1')
}

// ─────────────────────────────────────────────
// TOGGLE PUBLISHED
// ─────────────────────────────────────────────
export async function publishEvent(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid event id.' }

  const supabase = await createClient()
  const { error } = await supabase.from('events').update({ is_published: true }).eq('id', id)
  if (error) return { error: 'Could not publish.' }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}

export async function unpublishEvent(formData: FormData) {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions.' }
  const id = String(formData.get('id') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid event id.' }

  const supabase = await createClient()
  const { error } = await supabase.from('events').update({ is_published: false }).eq('id', id)
  if (error) return { error: 'Could not unpublish.' }
  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
}
