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

const BRANCH_SLUGS = ['cavite', 'taguig', 'quezon-city', 'valenzuela'] as const

const adminLoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8),
  // Optional at the schema level — required only for role='admin', checked
  // after we know the role (see below). Super admins leave it blank.
  branch: z.enum(BRANCH_SLUGS).optional().or(z.literal('')),
})

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const BRANCH_LABEL: Record<string, string> = {
  cavite: 'Dasmariñas, Cavite',
  taguig: 'Taguig',
  'quezon-city': 'Quezon City',
  valenzuela: 'Valenzuela',
}

export async function adminLogin(formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    branch: formData.get('branch') ?? '',
  })
  if (!parsed.success) {
    return { error: 'Enter a valid email and password.' }
  }
  const { email, password, branch: selectedBranch } = parsed.data

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

  // Branch check — only plain 'admin' accounts are branch-scoped. If this
  // is their first login, the selected branch becomes their permanent
  // assignment (locked thereafter — see the enforce_branch_reassignment
  // trigger in migration 0020). If already assigned, the selection must
  // match; a mismatch is rejected and the just-created session is undone.
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role === 'admin') {
      if (!selectedBranch) {
        await supabase.auth.signOut()
        return { error: 'Please select your branch.' }
      }
      if (!profile.branch) {
        const { error: assignErr } = await supabase
          .from('profiles')
          .update({ branch: selectedBranch })
          .eq('id', user.id)
        if (assignErr) {
          console.error('[adminLogin] branch assignment', assignErr)
          await supabase.auth.signOut()
          return { error: 'Could not assign your branch. Please try again.' }
        }
      } else if (profile.branch !== selectedBranch) {
        await supabase.auth.signOut()
        return {
          error: `This account is assigned to ${BRANCH_LABEL[profile.branch] ?? profile.branch}. Please select that branch.`,
        }
      }
    }
    // role === 'super_admin' (or no profile / non-admin): branch selection
    // is ignored entirely — requireAdmin() on /admin still gates access.
  }

  // Middleware will gate /admin/* behind aal2.
  // If TOTP isn't enrolled yet, the middleware bounces to /mfa-enroll (future).
  // If TOTP is enrolled, /mfa-challenge takes them through the second factor.
  redirect('/admin')
}
