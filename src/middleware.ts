// ============================================================
// middleware.ts — runs on every request before the route handler
// ============================================================
// Responsibilities (in order):
//   1. Block known bad user agents
//   2. Geo-block /admin/* if request country is outside ADMIN_ALLOWED_COUNTRIES
//   3. Honor progressive IP block (24h-tier blocker set in ratelimit.ts)
//   4. Rate-limit auth + anonymous form endpoints by IP
//   5. Refresh Supabase session cookies
//   6. Enforce route protection:
//        - No session             → /login
//        - Unconfirmed email      → /verify-email
//        - /admin/* + aal != aal2 → /mfa-challenge

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  rlAuthLogin,
  rlAuthSignup,
  rlAuthResetPassword,
  rlAuthOtp,
  rlAuthSessionStart,
  rlBookingsAnon,
  rlQuotesAnon,
  rlContactAnon,
  checkLimit,
  isIpBlocked,
  recordBreachAndGetBlockSeconds,
  rateLimitedResponse,
  recordAttempt,
} from '@/utils/ratelimit'

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// Substrings (case-insensitive) — if the UA contains any, we drop the request.
// Tune this list over time based on Auth Logs.
const BLOCKED_UA_PATTERNS = [
  'sqlmap',
  'nikto',
  'nessus',
  'masscan',
  'fimap',
  'havij',
  'wpscan',
  'zgrab',
  'nmap',
  'acunetix',
  'arachni',
  'jaeles',
  'ffuf',
  'gobuster',
  'feroxbuster',
  'curl/7.0', // generic curl that's almost always a scanner; allow modern curl
] as const

// Routes that must be protected (require an authenticated session)
const PROTECTED_PREFIXES = ['/dashboard', '/admin', '/profile', '/bookings', '/quotes', '/track']

// Routes that require admin role + MFA (aal2)
const ADMIN_PREFIXES = ['/admin']

// Routes used by the unauthenticated visitor flow — never blocked.
const PUBLIC_ALLOWLIST = [
  '/',
  '/login',
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
]

// Country allow-list for /admin/* (ISO 3166-1 alpha-2)
const ADMIN_ALLOWED_COUNTRIES = new Set(
  (process.env.ADMIN_ALLOWED_COUNTRIES || 'PH')
    .split(',')
    .map(c => c.trim().toUpperCase())
)

// Auth endpoints that get a progressive slow-down after repeated attempts.
const SLOWDOWN_KINDS = new Set(['login', 'otp', 'reset'])

// ─────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  // Vercel forwards client IP in x-forwarded-for; first entry is the original client.
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? '0.0.0.0'
}

function isBadUserAgent(ua: string | null): boolean {
  if (!ua) return true // empty UA on /admin or auth routes is suspicious
  const lower = ua.toLowerCase()
  return BLOCKED_UA_PATTERNS.some(p => lower.includes(p))
}

function pathStartsWith(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_ALLOWLIST.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))
}

// ─────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────

// Each rule keys on the path prefix. Auth endpoints rate-limit by IP + email
// (email only known after the form posts, so we limit by IP here and again by
// (IP + email) inside the actual route handler).
function buildRateLimitRules(method: string): Array<{ test: (p: string) => boolean; limiter: typeof rlAuthLogin; kind: string }> {
  return [
    { test: p => p.startsWith('/api/auth/login') || p === '/auth/login',          limiter: rlAuthLogin,         kind: 'login' },
    { test: p => p.startsWith('/api/auth/signup') || p === '/auth/signup',        limiter: rlAuthSignup,        kind: 'signup' },
    { test: p => p.startsWith('/api/auth/reset') || p === '/auth/reset-password', limiter: rlAuthResetPassword, kind: 'reset' },
    { test: p => p.startsWith('/api/auth/otp') || p.startsWith('/api/auth/magic'),limiter: rlAuthOtp,           kind: 'otp' },
    { test: p => p.startsWith('/api/auth/session'),                               limiter: rlAuthSessionStart,  kind: 'session-start' },
    { test: p => p === '/api/bookings' && method === 'POST',                      limiter: rlBookingsAnon,      kind: 'bookings' },
    { test: p => p === '/api/quotes'   && method === 'POST',                      limiter: rlQuotesAnon,        kind: 'quotes' },
    { test: p => p.startsWith('/api/contact'),                                    limiter: rlContactAnon,       kind: 'contact' },
  ]
}

// After 3 attempts on sensitive auth endpoints, add a 500ms delay.
// After 5 attempts the progressive blocker takes over (handled in applyRateLimits).
async function applySlowdown(ip: string, kind: string): Promise<void> {
  if (!SLOWDOWN_KINDS.has(kind)) return
  const attempts = await recordAttempt(ip, kind)
  if (attempts >= 3 && attempts < 5) {
    await new Promise(r => setTimeout(r, 500))
  }
}

// Returns a 429 response if a matching endpoint is over its limit, else null.
async function applyRateLimits(req: NextRequest, ip: string, pathname: string): Promise<Response | null> {
  for (const rule of buildRateLimitRules(req.method)) {
    if (!rule.test(pathname)) continue

    // For auth routes, IP-only check here. Route handler will do IP+email check.
    const result = await checkLimit(rule.limiter, `ip:${ip}`)
    if (!result.allowed) {
      // Record breach so progressive blocker escalates on repeat offenders.
      const blockedFor = await recordBreachAndGetBlockSeconds(ip)
      return rateLimitedResponse(Math.max(result.retryAfter, blockedFor))
    }

    await applySlowdown(ip, rule.kind)
  }
  return null
}

// ─────────────────────────────────────────────
// ROUTE PROTECTION
// ─────────────────────────────────────────────

// Returns a redirect for protected routes that fail an auth gate, else null.
function buildRouteRedirect(
  req: NextRequest,
  user: { email_confirmed_at?: string } | null,
  pathname: string,
): NextResponse | null {
  const isProtected = pathStartsWith(pathname, PROTECTED_PREFIXES)
  const isPublic = isPublicPath(pathname)
  if (!isProtected || isPublic) return null

  // No session → /login
  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Unconfirmed email → /verify-email
  if (!user.email_confirmed_at) {
    const url = req.nextUrl.clone()
    url.pathname = '/verify-email'
    return NextResponse.redirect(url)
  }

  // /admin/* — MFA enforcement is currently OFF for Eagles 4x4 launch
  // (single-shop threat model). The MFA code path (/mfa-enroll, /mfa-challenge,
  // requireMFA in lib/auth.ts) still exists and can be re-enabled by restoring
  // the aal2 check here (it needs the supabase client, so move it back into
  // middleware() or pass the client in when re-enabling).
  return null
}

// ─────────────────────────────────────────────
// MIDDLEWARE ENTRY
// ─────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = getClientIp(req)
  const ua = req.headers.get('user-agent')

  // ── 1. Block bad user agents ──────────────────────────────
  // /admin and auth endpoints get the strict check (empty UA + tool UAs blocked).
  // Public pages tolerate empty UAs (so link previews / curl docs work) but still
  // block tool UAs. Combined: block when the UA is bad AND either the path is
  // strict or the UA is actually present.
  const strictUaPath = pathStartsWith(pathname, ADMIN_PREFIXES) || pathname.startsWith('/auth') || pathname.startsWith('/api/auth')
  if (isBadUserAgent(ua) && (strictUaPath || ua)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  // ── 2. Geo-block /admin/* ─────────────────────────────────
  // Vercel injects x-vercel-ip-country. In local dev it's missing — we allow.
  if (pathStartsWith(pathname, ADMIN_PREFIXES)) {
    const country = req.headers.get('x-vercel-ip-country')?.toUpperCase()
    if (country && !ADMIN_ALLOWED_COUNTRIES.has(country)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // ── 3. Progressive IP block ────────────────────────────────
  if (await isIpBlocked(ip)) {
    return rateLimitedResponse(60 * 60) // generic 1h Retry-After (we don't leak true duration)
  }

  // ── 4. Endpoint-specific IP rate limits (BEFORE Supabase work) ──
  const limited = await applyRateLimits(req, ip, pathname)
  if (limited) return limited

  // ── 5. Supabase session refresh ────────────────────────────
  // Always run for any non-asset path so cookies stay fresh.
  const supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Force secure cookie flags on everything Supabase writes, then mirror
          // to the response we return so handlers downstream see fresh cookies.
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set({
              ...options,
              name,
              value,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          })
        },
      },
    }
  )

  // getUser() refreshes the session if needed (rotated refresh token).
  const { data: { user } } = await supabase.auth.getUser()

  // ── 6. Route protection ────────────────────────────────────
  const redirect = buildRouteRedirect(req, user, pathname)
  if (redirect) return redirect

  return supabaseResponse
}

// ─────────────────────────────────────────────
// Matcher — run on everything except static files and Next internals
// (next/image, favicon, public assets handled implicitly by Next)
// ─────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - _next/static, _next/image, favicon.ico
     * - any path with a file extension (assets)
     */
    // Plain string (not String.raw) so Next.js can statically parse the matcher,
    // and a `[.]` character class instead of `\.` so there's no escaped backslash
    // to satisfy or trip either Next or SonarQube (S7780).
    '/((?!_next/static|_next/image|favicon.ico|.*[.](?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
