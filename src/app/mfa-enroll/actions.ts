'use server'

// ============================================================
// /mfa-enroll actions — finish TOTP enrollment by verifying a code
// ============================================================
// SECURITY:
//  - requireAuth() — must be signed in to enroll a factor
//  - Rate limit per IP + per user — prevents code-guessing during enrollment

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { rlAuthOtp, checkLimit, recordBreachAndGetBlockSeconds } from '@/utils/ratelimit'

const schema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{4,8}$/, 'Code must be 4-8 digits'),
})

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function verifyEnrollment(formData: FormData) {
  const user = await requireAuth()

  const parsed = schema.safeParse({
    factorId: formData.get('factorId'),
    code: formData.get('code'),
  })
  if (!parsed.success) {
    return { error: 'Enter the 6-digit code from your authenticator app.' }
  }

  // Rate limit by IP AND user (defense against guessing the enrollment code)
  const ip = getIp()
  const rlIp   = await checkLimit(rlAuthOtp, `mfa-enroll:ip:${ip}`)
  const rlUser = await checkLimit(rlAuthOtp, `mfa-enroll:user:${user.id}`)
  if (!rlIp.allowed || !rlUser.allowed) {
    await recordBreachAndGetBlockSeconds(ip)
    return { error: 'Too many attempts. Try again in a few minutes.' }
  }

  const supabase = createClient()

  // 1. Issue a challenge for the pending factor.
  const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factorId,
  })
  if (chalErr || !challenge) {
    return { error: 'Could not start verification. Please refresh and try again.' }
  }

  // 2. Verify the code — on success this both marks the factor as verified
  //    AND upgrades the current session to aal2.
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  })

  if (verifyErr) {
    return { error: 'Code is incorrect. Try the next code shown in your app.' }
  }

  // Enrolled + signed-in with MFA → straight to admin home.
  redirect('/admin?mfaEnrolled=1')
}
