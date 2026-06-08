'use server'

// ============================================================
// /login server actions
// ============================================================
// Magic link / OTP customer sign-in. No password.
// Rate limits applied at middleware level (by IP) AND here (by email).

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { rlAuthOtp, checkAuthLimit, checkUniqueEmailsPerIp } from '@/utils/ratelimit'
import { headers } from 'next/headers'
import { z } from 'zod'

const emailSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

const otpSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  // Accept 4–8 digits — Supabase OTP length is configurable in the dashboard.
  token: z.string().regex(/^\d{4,8}$/, 'Code must be 4–8 digits'),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

// ─────────────────────────────────────────────
// 1. Send OTP / magic link to email
// ─────────────────────────────────────────────
export async function sendOtp(formData: FormData) {
  const parsed = emailSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }
  const { email } = parsed.data

  // Email + IP combined rate limit (our app-level)
  const ip = await getIp()
  const rl = await checkAuthLimit(rlAuthOtp, ip, email)
  if (!rl.allowed) {
    return { error: 'Too many requests. Try again later.' }
  }

  // Anti-abuse: cap unique emails registering from one IP per 24h.
  // Standard pattern used by most major platforms.
  const uniq = await checkUniqueEmailsPerIp(ip, email)
  if (!uniq.allowed) {
    return {
      error:
        `Too many different sign-ups from this network. ` +
        `Please try again tomorrow or contact us if this is a mistake.`,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Create the user on first OTP request (passwordless signup).
      shouldCreateUser: true,
      // No emailRedirectTo → no magic link path. Email contains the 6-digit code only.
    },
  })

  if (error) {
    console.error('[sendOtp]', error)
    // Detect Supabase's built-in SMTP rate limit (2 emails/hour, hard-capped).
    // Show a clear "wait" message instead of the generic error.
    const code = (error as { code?: string; status?: number }).code
    const status = (error as { code?: string; status?: number }).status
    const msg = error.message ?? ''
    if (
      code === 'over_email_send_rate_limit' ||
      status === 429 ||
      /rate limit/i.test(msg)
    ) {
      return {
        error:
          `Our email system is at its hourly limit. ` +
          `Please wait about an hour and try again. ` +
          `(This will be lifted once we upgrade our email provider.)`,
        rateLimited: true as const,
      }
    }
    // Generic fallback — don't leak whether the email exists.
    return { error: 'Could not send sign-in email. Try again in a moment.' }
  }

  return { success: true, email }
}

// ─────────────────────────────────────────────
// 2. Verify the 6-digit OTP code typed into the form
//    (Alternative path to clicking the magic link.)
// ─────────────────────────────────────────────
export async function verifyOtp(formData: FormData) {
  const parsed = otpSchema.safeParse({
    email: formData.get('email'),
    token: formData.get('token'),
  })
  if (!parsed.success) {
    return { error: 'Please enter the 6-digit code from your email.' }
  }
  const { email, token } = parsed.data

  const ip = await getIp()
  const rl = await checkAuthLimit(rlAuthOtp, ip, email)
  if (!rl.allowed) {
    return { error: 'Too many attempts. Try again later.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    return { error: 'Code is invalid or expired.' }
  }

  // Successful sign-in → go home (or wherever ?next= points)
  redirect('/')
}
