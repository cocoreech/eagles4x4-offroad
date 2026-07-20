// ============================================================
// routeProtection — pure route-gating decisions for the middleware
// ============================================================
// Extracted from middleware.ts so the matching logic can be unit-tested
// without pulling in Supabase / WAF / rate-limit. The middleware imports
// `requiresAuth` (route protection) and `pathHasPrefix` (admin geo/UA checks).

// Routes that require an authenticated session.
export const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/profile', '/bookings', '/quotes', '/track'] as const

// Routes that require admin role (+ MFA when re-enabled).
export const ADMIN_PREFIXES = ['/admin'] as const

// Routes used by the unauthenticated visitor flow — never gated.
const PUBLIC_ALLOWLIST = [
  '/',
  '/login',
  '/admin/login',
  '/admin/forgot-password',
  '/signup',
  '/verify-email',
  '/mfa-challenge',
  '/auth/callback',
  '/auth/confirm',
  '/services',
  '/builds',
  '/events',
  '/about',
  '/api/webhooks/paymongo', // external webhook receiver — auth via HMAC signature
  '/_next', // assets
  '/favicon.ico',
  '/manifest.webmanifest',
] as const

// Guest checkout: these live under the protected `/bookings` prefix but must
// stay public so a visitor can book and view their confirmation without an
// account. The account-scoped routes (`/bookings` list, `/bookings/[code]`
// detail, `/edit`) remain protected.
const GUEST_BOOKING_SUCCESS_RE = /^\/bookings\/[^/]+\/success\/?$/

function isGuestBookingPath(pathname: string): boolean {
  return pathname === '/bookings/new' || GUEST_BOOKING_SUCCESS_RE.test(pathname)
}

/**
 * True when `pathname` equals `prefix` or is a descendant segment of it.
 * Segment-aware: `/admin` matches `/admin` and `/admin/x` but NOT
 * `/administrator`. Critically, `/` matches only `/` — not every path.
 */
function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/** True when `pathname` falls under any of the given prefixes. */
export function pathHasPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => underPrefix(pathname, p))
}

function isPublicPath(pathname: string): boolean {
  return pathHasPrefix(pathname, PUBLIC_ALLOWLIST)
}

/** Whether the route requires an authenticated session (the middleware gate). */
export function requiresAuth(pathname: string): boolean {
  if (isGuestBookingPath(pathname)) return false
  if (isPublicPath(pathname)) return false
  return pathHasPrefix(pathname, PROTECTED_PREFIXES)
}
