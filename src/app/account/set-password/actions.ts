'use server'

// ============================================================
// /account/set-password actions
// ============================================================
// Lets the currently signed-in user set or change their password.
// Used by admins after signing in via OTP for the first time, so they
// can later use the /admin/login path with email + password (+ MFA).
//
// SECURITY:
//  - requireAuth() — explicit guard, not just an inline getUser() check
//  - Password length bounded (12-128 chars) — prevents DoS via huge string
//  - Must contain mix of letters + digits — basic complexity check
//  - Rate limit per user — prevents rapid password churn / abuse

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { rlAuthResetPassword, checkLimit } from '@/utils/ratelimit'

const passwordSchema = z.object({
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password is too long (max 128 characters)')
    .refine(v => /[A-Za-z]/.test(v) && /[0-9]/.test(v),
      'Password must include letters and numbers'),
  confirm: z.string().max(128),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function setPassword(formData: FormData) {
  const user = await requireAuth()

  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirm:  formData.get('confirm'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  // Rate limit by user — same as reset-password rules
  const ip = await getIp()
  const rl = await checkLimit(rlAuthResetPassword, `set-password:${user.id}:${ip}`)
  if (!rl.allowed) {
    return { error: 'Too many password changes. Please wait a few minutes.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) {
    console.error('[setPassword]', error)
    return { error: 'Could not update password. Please try again.' }
  }

  redirect('/?passwordSet=1')
}
