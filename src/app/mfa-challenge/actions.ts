'use server'

// ============================================================
// /mfa-challenge actions
// ============================================================
// Used by admins to upgrade their session from aal1 → aal2.
// Customer accounts won't hit this page (no TOTP enrolled).
//
// SECURITY:
//  - requireAuth() — must be signed in to even attempt MFA
//  - Rate limit per IP + per user — TOTP brute-force protection
//    (6-digit code = 1M combinations; without rate limit a single IP
//     could try 100k codes/minute and break in ~10 min)

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import { rlAuthOtp, checkLimit, recordBreachAndGetBlockSeconds } from '@/utils/ratelimit'

const codeSchema = z.object({
  code: z.string().regex(/^\d{4,8}$/, 'Code must be 4-8 digits'),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

// ─────────────────────────────────────────────
// Submit a TOTP code to challenge + verify the user's enrolled factor.
// ─────────────────────────────────────────────
export async function verifyMfa(formData: FormData) {
  // Must be signed in to attempt MFA — explicit guard
  const user = await requireAuth()

  const parsed = codeSchema.safeParse({ code: formData.get('code') })
  if (!parsed.success) {
    return { error: 'Enter the 6-digit code from your authenticator app.' }
  }

  // Rate limit by IP AND user — prevents brute-force of the TOTP code
  const ip = await getIp()
  const rlIp   = await checkLimit(rlAuthOtp, `mfa:ip:${ip}`)
  const rlUser = await checkLimit(rlAuthOtp, `mfa:user:${user.id}`)
  if (!rlIp.allowed || !rlUser.allowed) {
    // Escalate breach so progressive blocker can kick in
    await recordBreachAndGetBlockSeconds(ip)
    return { error: 'Too many attempts. Try again in a few minutes.' }
  }

  const supabase = await createClient()

  // 1. List enrolled factors. We use the first verified TOTP.
  const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors()
  if (factorsErr) return { error: 'Could not load MFA factors.' }
  const totp = factors?.totp?.find(f => f.status === 'verified')
  if (!totp) {
    // User has no TOTP enrolled — push them to enrollment instead.
    redirect('/mfa-enroll')
  }

  // 2. Issue a challenge for that factor.
  const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
  if (chalErr || !challenge) return { error: 'Could not start MFA challenge.' }

  // 3. Verify the code → upgrades JWT to aal2.
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  })

  if (verifyErr) {
    return { error: 'Invalid code. Try again.' }
  }

  // After aal2 upgrade, redirect to wherever the user was headed (?next=) or /admin.
  redirect('/admin')
}
