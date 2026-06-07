// ============================================================
// Auth helpers — used in Server Actions, API routes, RSC
// ============================================================
// Always read the user from Supabase (never trust client-supplied IDs).
// Throws structured errors that callers can map to redirects or 401/403.

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export class AuthError extends Error {
  constructor(public code: 'unauthenticated' | 'unconfirmed' | 'no-mfa' | 'not-admin', message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

// ─────────────────────────────────────────────
// Get the current user (or null if not signed in).
// NEVER use auth.getSession() server-side — it doesn't verify the JWT.
// auth.getUser() validates with the Supabase server.
// ─────────────────────────────────────────────
export async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─────────────────────────────────────────────
// Require an authenticated user. Use in any route that customers access.
// Optional `redirectTo` overrides the default /login redirect path.
// ─────────────────────────────────────────────
export async function requireAuth(redirectTo: string = '/login') {
  const user = await getUser()
  if (!user) redirect(redirectTo)
  return user
}

// ─────────────────────────────────────────────
// Require an email-confirmed user. Unconfirmed accounts get bounced to /verify-email.
// ─────────────────────────────────────────────
export async function requireConfirmed(redirectTo: string = '/verify-email') {
  const user = await requireAuth()
  if (!user.email_confirmed_at) redirect(redirectTo)
  return user
}

// ─────────────────────────────────────────────
// Require admin role (admin OR super_admin) — checked against public.profiles.
// Uses the same is_admin() logic as RLS, but in app code for early-rejection.
// ─────────────────────────────────────────────
export async function requireAdmin(redirectTo: string = '/') {
  const user = await requireConfirmed()
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    redirect(redirectTo)
  }
  return { user, profile }
}

// ─────────────────────────────────────────────
// Require super_admin specifically. Use for irreversible actions:
// promoting other admins, deleting customers, changing platform config.
// ─────────────────────────────────────────────
export async function requireSuperAdmin(redirectTo: string = '/') {
  const user = await requireConfirmed()
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin') {
    redirect(redirectTo)
  }
  return { user, profile }
}

// ─────────────────────────────────────────────
// Require MFA (aal2). Used on all /admin/* server actions.
// Reads the Authenticator Assurance Level from the JWT — aal2 means
// the user has completed a TOTP / WebAuthn challenge this session.
// ─────────────────────────────────────────────
export async function requireMFA(redirectTo: string = '/mfa-challenge') {
  const user = await requireConfirmed()
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || data?.currentLevel !== 'aal2') redirect(redirectTo)
  return user
}

// ─────────────────────────────────────────────
// Combined: admin + MFA. The most-protected gate.
// ─────────────────────────────────────────────
export async function requireAdminWithMFA(redirectTo: string = '/mfa-challenge') {
  const adminCtx = await requireAdmin()
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || data?.currentLevel !== 'aal2') redirect(redirectTo)
  return adminCtx
}

// ─────────────────────────────────────────────
// Helper for API routes that should never expose internal errors.
// Wrap your route body and this returns either the result or a sanitised 500.
// ─────────────────────────────────────────────
export async function safeHandler<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const result = await fn()
    return new Response(JSON.stringify(result ?? { ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Log full error server-side (Vercel logs); send generic to client.
    console.error('[safeHandler]', err)
    return new Response(
      JSON.stringify({ error: 'Something went wrong' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
