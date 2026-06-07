// ============================================================
// Supabase browser client (Client Components only)
// ============================================================
// Reads the same httpOnly cookies set by the server client — the browser
// never sees the JWT directly. Use this in 'use client' components for
// realtime subscriptions, optimistic UI updates, and client-side reads.

import { createBrowserClient } from '@supabase/ssr'

/**
 * Returns a singleton-style browser client.
 * Calling this multiple times in the same tab is fine — @supabase/ssr
 * handles the dedup internally via cookies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
