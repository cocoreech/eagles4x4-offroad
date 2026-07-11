// ============================================================
// /auth/callback — exchange Supabase auth code for a session
// ============================================================
// Triggered by:
//   - Magic-link clicks (email signup / passwordless login)
//   - OAuth provider redirects (Google, etc.)
//   - Email confirmation links
// The link always carries either `code` or `token_hash` + `type`.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { linkGuestBookings } from '@/lib/auth'
import { claimGuestConversation } from '@/lib/inbox/guestClaim'

// On sign-in, adopt anything this browser/email created as a guest. Best-effort
// — a failure must not block the redirect. Bookings match on email; the chat
// history matches on the guest session cookie (same-browser only, see ADR-0004).
async function claimGuestDataForCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await linkGuestBookings(user.id, user.email)
  await claimGuestConversation(user.id)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  // Only same-origin relative redirects (blocks open-redirect via "//evil.com").
  const nextRaw = url.searchParams.get('next') ?? '/'
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/'

  const supabase = await createClient()

  // ── 1. OAuth / PKCE code flow ─────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await claimGuestDataForCurrentUser()
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('[auth/callback] exchangeCodeForSession error', error)
  }

  // ── 2. Email OTP / magic-link / confirmation hash flow ────
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
      token_hash: tokenHash,
    })
    if (!error) {
      await claimGuestDataForCurrentUser()
      return NextResponse.redirect(new URL(next, url.origin))
    }
    console.error('[auth/callback] verifyOtp error', error)
  }

  // ── 3. Anything else → bounce to login with a generic error ──
  const loginUrl = new URL('/login', url.origin)
  loginUrl.searchParams.set('error', 'auth_callback_failed')
  return NextResponse.redirect(loginUrl)
}
