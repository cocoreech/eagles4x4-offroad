// ============================================================
// /logout — sign the user out and bounce home
// ============================================================
// Implemented as a GET route handler so a plain <a href="/logout"> works
// (no JavaScript required). Supabase signOut clears the session cookies.

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL(req.url)
  return NextResponse.redirect(new URL('/', url.origin))
}

// Allow POST too (for forms with method="post")
export async function POST(req: Request) {
  return GET(req)
}
