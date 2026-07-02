'use server'

// ============================================================
// Admin availability actions — weekly hours, settings, closed dates
// ============================================================

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { rlAdminGeneral, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

async function adminRateGuard(userId: string) {
  const result = await checkLimit(rlAdminGeneral, `availability-action:${userId}:${await getIp()}`)
  return result.allowed
}

const hour = z.coerce.number().int().min(0).max(24)
const optHour = z.preprocess(v => (v === '' || v == null ? null : v), hour.nullable())

const weekdayRowSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  is_open: z.preprocess(v => v === 'true' || v === 'on' || v === true, z.boolean()),
  open_hour: hour,
  close_hour: hour,
  lunch_start_hour: optHour,
  lunch_end_hour: optHour,
}).refine(r => r.open_hour < r.close_hour, { message: 'Open hour must be before close hour.' })

export async function saveWeeklyHours(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }

  const rows = []
  for (let wd = 0; wd <= 6; wd++) {
    const parsed = weekdayRowSchema.safeParse({
      weekday: wd,
      is_open: formData.get(`is_open_${wd}`) ?? 'false',
      open_hour: formData.get(`open_hour_${wd}`) ?? '8',
      close_hour: formData.get(`close_hour_${wd}`) ?? '18',
      lunch_start_hour: formData.get(`lunch_start_${wd}`) ?? '',
      lunch_end_hour: formData.get(`lunch_end_${wd}`) ?? '',
    })
    if (!parsed.success) return { error: `Day ${wd}: ${parsed.error.issues[0]?.message ?? 'invalid'}` }
    rows.push(parsed.data)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('shop_hours').upsert(rows, { onConflict: 'weekday' })
  if (error) {
    console.error('[saveWeeklyHours]', error)
    return { error: 'Could not save weekly hours.' }
  }
  revalidatePath('/admin/availability')
  revalidatePath('/bookings/new')
  return { success: true }
}

const settingsSchema = z.object({
  slot_capacity: z.coerce.number().int().min(1).max(50),
  booking_window_months: z.coerce.number().int().min(1).max(24),
})

export async function saveSettings(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }

  const parsed = settingsSchema.safeParse({
    slot_capacity: formData.get('slot_capacity'),
    booking_window_months: formData.get('booking_window_months'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid settings.' }

  const supabase = await createClient()
  const { error } = await supabase.from('shop_settings').upsert({ id: 1, ...parsed.data }, { onConflict: 'id' })
  if (error) {
    console.error('[saveSettings]', error)
    return { error: 'Could not save settings.' }
  }
  revalidatePath('/admin/availability')
  revalidatePath('/bookings/new')
  return { success: true }
}

const closedDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date.'),
  max_bookings: z.preprocess(v => (v === '' || v == null ? null : v), z.coerce.number().int().min(0).max(50).nullable()),
})

export async function addClosedDate(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }

  const parsed = closedDateSchema.safeParse({
    date: formData.get('date'),
    max_bookings: formData.get('max_bookings') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid date.' }

  // max_bookings present + null-closed = capacity override for an open day;
  // otherwise mark the date closed.
  const isCapacityOverride = parsed.data.max_bookings != null
  const supabase = await createClient()
  const { error } = await supabase.from('availability').upsert(
    {
      date: parsed.data.date,
      is_closed: !isCapacityOverride,
      max_bookings: parsed.data.max_bookings,
    },
    { onConflict: 'date' },
  )
  if (error) {
    console.error('[addClosedDate]', error)
    return { error: 'Could not save the date.' }
  }
  revalidatePath('/admin/availability')
  revalidatePath('/bookings/new')
  return { success: true }
}

export async function removeClosedDate(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const { user } = await requireAdmin()
  if (!(await adminRateGuard(user.id))) return { error: 'Too many admin actions. Please slow down.' }

  const date = String(formData.get('date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date.' }

  const supabase = await createClient()
  const { error } = await supabase.from('availability').delete().eq('date', date)
  if (error) {
    console.error('[removeClosedDate]', error)
    return { error: 'Could not remove the date.' }
  }
  revalidatePath('/admin/availability')
  revalidatePath('/bookings/new')
  return { success: true }
}
