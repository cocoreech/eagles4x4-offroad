'use server'

// ============================================================
// /admin/login server actions
// ============================================================
// Email + password sign-in for admins. After password verifies,
// the middleware will redirect to /mfa-challenge for the TOTP step
// (if the account has MFA enrolled).

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { rlAuthLogin, checkAuthLimit, recordAttempt, clearAttempts } from '@/utils/ratelimit'

const adminLoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function adminLogin(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Enter a valid email and password.' }
  }
  const { email, password } = parsed.data

  // IP + email combined rate limit (middleware also limits by IP)
  const ip = await getIp()
  const rl = await checkAuthLimit(rlAuthLogin, ip, email)
  if (!rl.allowed) return { error: 'Too many attempts. Try again later.' }

  // Slow-down after 3 failed attempts (in addition to middleware's slow-down)
  const attempts = await recordAttempt(ip, 'admin-login')
  if (attempts >= 3 && attempts < 5) {
    await new Promise(r => setTimeout(r, 500))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Never leak whether the email exists vs. password wrong
    return { error: 'Invalid email or password.' }
  }

  // Successful password step — clear failed-attempt counter.
  await clearAttempts(ip, 'admin-login')

  // Middleware will gate /admin/* behind aal2.
  // If TOTP isn't enrolled yet, the middleware bounces to /mfa-enroll (future).
  // If TOTP is enrolled, /mfa-challenge takes them through the second factor.
  redirect('/admin')
}
