// ============================================================
// POST /api/track  — records a single page view
// ============================================================
// Called by <PageViewTracker /> via navigator.sendBeacon on route change.
// Privacy-first: we store only the path + a daily-rotating, non-reversible
// visitor hash. No IPs, no user-agents, no cookies are persisted.

import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { rlApiGeneral, checkLimit } from '@/utils/ratelimit'

export const dynamic = 'force-dynamic'

// Obvious non-human agents — keep the count honest.
const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python|headless|lighthouse|pingdom|uptime/i

// Paths we never count: admin, auth, and internal endpoints.
const SKIP_PREFIXES = ['/admin', '/api', '/login', '/mfa', '/logout', '/account', '/verify']

function getIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? '0.0.0.0'
}

export async function POST(req: NextRequest) {
  // Parse + normalise the path (pathname only, length-capped).
  let path = '/'
  try {
    const body = (await req.json()) as { path?: unknown }
    if (typeof body.path === 'string' && body.path.startsWith('/')) {
      path = body.path.split('?')[0].split('#')[0].slice(0, 200)
    }
  } catch {
    // malformed body — treat as untrackable, respond OK so the beacon is quiet
    return new NextResponse(null, { status: 204 })
  }

  if (SKIP_PREFIXES.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p))) {
    return new NextResponse(null, { status: 204 })
  }

  const ua = req.headers.get('user-agent') ?? ''
  if (!ua || BOT_RE.test(ua)) {
    return new NextResponse(null, { status: 204 })
  }

  const ip = getIp(req)

  // Light per-IP rate limit — prevents trivial count inflation. If exceeded
  // we simply don't record (204), never surface an error to the visitor.
  const rl = await checkLimit(rlApiGeneral, `track:${ip}`)
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 })
  }

  // Daily-rotating, non-reversible visitor hash. The service-role key doubles
  // as a server-only secret salt so hashes can't be reconstructed offline.
  const day = new Date().toISOString().slice(0, 10)
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eagles4x4'
  const visitorHash = createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex')

  try {
    const supabase = createServiceRoleClient()
    await supabase.from('page_views').insert({ path, visitor_hash: visitorHash })
  } catch (err) {
    // Never let analytics break navigation — swallow and move on.
    console.error('[track]', err)
  }

  return new NextResponse(null, { status: 204 })
}
