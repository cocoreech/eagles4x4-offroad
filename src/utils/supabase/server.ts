// ============================================================
// Supabase server client (Next.js App Router / RSC / Server Actions / Route Handlers)
// ============================================================
// Returns a fresh client per request so it reads/writes the right cookies.
// JWT is stored in httpOnly cookies — never localStorage.

import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Use in: Server Components, Server Actions, Route Handlers.
 * Reads the user's session from httpOnly cookies set by the browser.
 * Returns a per-request client — do not memoize across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({
                ...options,
                name,
                value,
                // Hardened cookie defaults — Supabase already sets these
                // but we re-assert them for defense-in-depth.
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
              })
            })
          } catch {
            // Server Component context: cookies are read-only.
            // The middleware refresh handles cookie writes — safe to ignore.
          }
        },
      },
    }
  )
}

/**
 * Service-role client. Bypasses RLS — use ONLY for trusted server-side
 * operations: cron jobs, admin actions, system-level inserts.
 * NEVER expose this client to the browser, NEVER pass it to a client component.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Service-role operations are disabled.'
    )
  }

  return createAdminClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
