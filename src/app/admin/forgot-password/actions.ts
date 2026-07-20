'use server'

// ============================================================
// /admin/forgot-password server action
// ============================================================
// Sends a Supabase password-recovery email. The link routes through
// /auth/callback (type=recovery), which exchanges it for a session,
// then lands the admin on /account/set-password to pick a new one.

import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { rlAuthResetPassword, checkAuthLimit } from '@/utils/ratelimit'

const emailSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function requestAdminPasswordReset(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }
  const { email } = parsed.data

  const ip = await getIp()
  const rl = await checkAuthLimit(rlAuthResetPassword, ip, email)
  if (!rl.allowed) {
    return { error: 'Too many requests. Try again later.' }
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/account/set-password')}`,
  })

  if (error) {
    console.error('[requestAdminPasswordReset]', error)
    // Don't leak whether the email exists — same generic success either way.
  }

  // Always report success so we never confirm/deny account existence.
  return { success: true as const }
}
