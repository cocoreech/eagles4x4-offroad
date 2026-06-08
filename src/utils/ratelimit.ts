// ============================================================
// Rate limiting — Upstash Redis + @upstash/ratelimit
// ============================================================
// Sliding window algorithm = most accurate for production traffic.
// Identifiers:
//   - Anonymous endpoints  → IP address
//   - Authenticated routes → user UUID
//   - Auth-form endpoints  → IP AND email together (defeats refresh-bypass)

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─────────────────────────────────────────────
// Redis client (Upstash)
// ─────────────────────────────────────────────
// In dev without env vars we fall back to a no-op limiter so the app
// still runs. In production these MUST be set.
const hasUpstashEnv =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_URL.startsWith('<')

const redis = hasUpstashEnv
  ? Redis.fromEnv()
  : (null as unknown as Redis)

// ─────────────────────────────────────────────
// Helper: build a Ratelimit instance with shared analytics + a unique prefix.
// The prefix isolates counters per endpoint type in Redis so they don't collide.
// ─────────────────────────────────────────────
function makeLimiter(
  prefix: string,
  limit: number,
  window: `${number}${'s' | 'm' | 'h'}`
): Ratelimit | null {
  if (!hasUpstashEnv) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `eagles4x4:${prefix}`,
  })
}

// ─────────────────────────────────────────────
// ENDPOINT LIMITERS
// ─────────────────────────────────────────────
// Dev mode uses very loose limits so you can iterate fast.
// Production limits are tight per the security spec.
// NEXT_PUBLIC_SITE_URL containing "localhost" is a reliable dev signal
// (NODE_ENV is sometimes 'production' during a `next build` even on a dev machine).
const isDev =
  process.env.NODE_ENV === 'development' ||
  (process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') ?? false)

// AUTH endpoints — by IP AND by identifier (email) when available
export const rlAuthLogin = isDev
  ? makeLimiter('auth:login', 100, '1 m')
  : makeLimiter('auth:login', 5,   '15 m')

export const rlAuthSignup = isDev
  ? makeLimiter('auth:signup', 100, '1 m')
  : makeLimiter('auth:signup', 3,   '1 h')

export const rlAuthResetPassword = isDev
  ? makeLimiter('auth:reset', 100, '1 m')
  : makeLimiter('auth:reset', 3,   '15 m')

export const rlAuthOtp = isDev
  ? makeLimiter('auth:otp', 100, '1 m')
  : makeLimiter('auth:otp', 3,   '10 m')

export const rlAuthSessionStart = isDev
  ? makeLimiter('auth:session-start', 100, '1 m')
  : makeLimiter('auth:session-start', 5,   '15 m')

// ANONYMOUS form endpoints — by IP
export const rlBookingsAnon = isDev
  ? makeLimiter('bookings:anon', 100, '1 m')
  : makeLimiter('bookings:anon', 5,   '1 h')

export const rlQuotesAnon = isDev
  ? makeLimiter('quotes:anon', 100, '1 m')
  : makeLimiter('quotes:anon', 5,   '1 h')

export const rlContactAnon = isDev
  ? makeLimiter('contact:anon', 100, '1 m')
  : makeLimiter('contact:anon', 3,   '10 m')

// AUTHENTICATED endpoints — by user ID
export const rlServerAction = isDev
  ? makeLimiter('action:user', 1000, '1 m')
  : makeLimiter('action:user', 20,   '1 m')

export const rlUpload = isDev
  ? makeLimiter('upload:user', 100, '1 m')
  : makeLimiter('upload:user', 10,  '1 h')

export const rlApiGeneral = isDev
  ? makeLimiter('api:user', 1000, '1 m')
  : makeLimiter('api:user', 100,  '1 m')

export const rlAdminGeneral = isDev
  ? makeLimiter('admin:user', 1000, '1 m')
  : makeLimiter('admin:user', 30,   '1 m')

// ─────────────────────────────────────────────
// Progressive IP blocking (in-Redis state, not a Ratelimit instance)
// First breach    → block for 15 min
// Repeat breach   → block for 1 hour
// Third+ breach   → block for 24 hours
// ─────────────────────────────────────────────
const BREACH_TTL_SECONDS = 24 * 60 * 60 // counter expires after 24h
const BLOCK_DURATIONS_SEC = [15 * 60, 60 * 60, 24 * 60 * 60]

export async function recordBreachAndGetBlockSeconds(ip: string): Promise<number> {
  // Dev: never escalate breaches into a hard block.
  if (isDev || !hasUpstashEnv) return 0
  const key = `eagles4x4:breach:${ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, BREACH_TTL_SECONDS)
  const tier = Math.min(count - 1, BLOCK_DURATIONS_SEC.length - 1)
  const blockSeconds = BLOCK_DURATIONS_SEC[tier]
  await redis.set(`eagles4x4:block:${ip}`, '1', { ex: blockSeconds })
  return blockSeconds
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  // Dev: bypass any pre-existing block records from earlier testing.
  if (isDev || !hasUpstashEnv) return false
  const blocked = await redis.get<string>(`eagles4x4:block:${ip}`)
  return !!blocked
}

// ─────────────────────────────────────────────
// Slow-down counters (tracks recent failed attempts per IP)
// After 3 attempts → 500ms delay
// After 5 attempts → 429 (hard block via progressive blocker above)
// ─────────────────────────────────────────────
const ATTEMPT_WINDOW_SECONDS = 15 * 60

export async function recordAttempt(ip: string, kind: string): Promise<number> {
  if (!hasUpstashEnv) return 0
  const key = `eagles4x4:attempts:${kind}:${ip}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, ATTEMPT_WINDOW_SECONDS)
  return count
}

export async function clearAttempts(ip: string, kind: string): Promise<void> {
  if (!hasUpstashEnv) return
  await redis.del(`eagles4x4:attempts:${kind}:${ip}`)
}

// ─────────────────────────────────────────────
// UNIQUE EMAILS PER IP (signup abuse protection)
// Industry standard: ~5 unique emails per IP per 24h, then add friction (CAPTCHA).
// Important for PH: mobile carriers use CGNAT so MANY real users share one IP.
// Loose enough for households + small offices, strict enough to block bot farms.
// ─────────────────────────────────────────────
const UNIQUE_EMAILS_LIMIT  = 5
const UNIQUE_EMAILS_WINDOW = 24 * 60 * 60 // 24 hours

export async function checkUniqueEmailsPerIp(
  ip: string,
  email: string
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Dev: skip — testing should not be throttled by this.
  if (isDev || !hasUpstashEnv) {
    return { allowed: true, current: 0, limit: UNIQUE_EMAILS_LIMIT }
  }
  const key = `eagles4x4:unique-emails:${ip}`
  // SADD is idempotent — adding the same email twice doesn't grow the set.
  await redis.sadd(key, email.toLowerCase())
  await redis.expire(key, UNIQUE_EMAILS_WINDOW)
  const count = await redis.scard(key)
  return {
    allowed: count <= UNIQUE_EMAILS_LIMIT,
    current: count,
    limit: UNIQUE_EMAILS_LIMIT,
  }
}

// ─────────────────────────────────────────────
// AI TOKEN / COST LIMITS — for when we wire up OpenAI/Anthropic in Phase 4 Step 5
// Conservative defaults (cheap). Easy to raise in dashboard later.
// All currency in USD (cheaper than tracking exchange rates).
// Rough: ₱56 ≈ $1 — adjust if peso weakens.
// ─────────────────────────────────────────────
const AI_CUSTOMER_DAILY_GENERATIONS = 3       // 3 AI replies/day per customer
const AI_CUSTOMER_DAILY_USD_CAP     = 0.05    // ~₱3 per customer per day
const AI_ADMIN_DAILY_GENERATIONS    = 20      // 20 drafts/day per admin
const AI_ADMIN_DAILY_USD_CAP        = 0.5     // ~₱30 per admin per day
const AI_SYSTEM_DAILY_USD_CAP       = 3       // ~₱180 platform-wide ceiling

const DAY_SECONDS = 24 * 60 * 60

type AiScope = 'customer' | 'admin' | 'system'

// Per-scope daily limits. 'system' is the platform-wide ceiling: no per-
// generation count limit, only the dollar cap applies.
const AI_GENERATION_LIMITS: Record<AiScope, number> = {
  customer: AI_CUSTOMER_DAILY_GENERATIONS,
  admin: AI_ADMIN_DAILY_GENERATIONS,
  system: Infinity,
}
const AI_USD_CAPS: Record<AiScope, number> = {
  customer: AI_CUSTOMER_DAILY_USD_CAP,
  admin: AI_ADMIN_DAILY_USD_CAP,
  system: AI_SYSTEM_DAILY_USD_CAP,
}

// Check how many AI generations a user has used today + their dollar spend.
// Returns whether the next generation should be allowed.
export async function checkAiBudget(
  scope: AiScope,
  userId: string
): Promise<{ allowed: boolean; reason?: string; usedUsd: number; capUsd: number }> {
  if (!hasUpstashEnv) {
    return { allowed: true, usedUsd: 0, capUsd: 0 }
  }
  const todayKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const genKey   = `eagles4x4:ai:gens:${scope}:${userId}:${todayKey}`
  const usdKey   = `eagles4x4:ai:usd:${scope}:${userId}:${todayKey}`

  const [gensRaw, usdRaw] = await Promise.all([
    redis.get<number>(genKey),
    redis.get<string>(usdKey),
  ])
  const gens = Number(gensRaw ?? 0)
  const usd  = Number(usdRaw ?? 0)

  const generationLimit = AI_GENERATION_LIMITS[scope]
  const usdCap = AI_USD_CAPS[scope]

  if (gens >= generationLimit) {
    return { allowed: false, reason: 'generation_limit', usedUsd: usd, capUsd: usdCap }
  }
  if (usd >= usdCap) {
    return { allowed: false, reason: 'budget_cap', usedUsd: usd, capUsd: usdCap }
  }
  return { allowed: true, usedUsd: usd, capUsd: usdCap }
}

// Record AI usage after a generation completes (called server-side only).
export async function recordAiUsage(
  scope: AiScope,
  userId: string,
  costUsd: number
): Promise<void> {
  if (!hasUpstashEnv) return
  const todayKey = new Date().toISOString().slice(0, 10)
  const genKey   = `eagles4x4:ai:gens:${scope}:${userId}:${todayKey}`
  const usdKey   = `eagles4x4:ai:usd:${scope}:${userId}:${todayKey}`

  // Increment counters; expire at end of day window.
  await Promise.all([
    redis.incr(genKey).then(() => redis.expire(genKey, DAY_SECONDS)),
    // Use incrbyfloat for USD spend (Upstash Redis supports it)
    redis.incrbyfloat(usdKey, costUsd).then(() => redis.expire(usdKey, DAY_SECONDS)),
  ])
}

// ─────────────────────────────────────────────
// Standard rate-limit response (used by middleware + route handlers)
// HTTP 429 + Retry-After header + generic body (no threshold leak)
// ─────────────────────────────────────────────
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))),
      },
    }
  )
}

// ─────────────────────────────────────────────
// Convenience: limit a single endpoint with a chosen limiter + identifier
// Returns { allowed: boolean, retryAfter: seconds-to-reset }
// ─────────────────────────────────────────────
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!limiter) return { allowed: true, retryAfter: 0 }
  const { success, reset } = await limiter.limit(identifier)
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000))
  return { allowed: success, retryAfter }
}

// ─────────────────────────────────────────────
// Combined identifier helper for auth endpoints: IP + email together.
// Both must pass — defeats attackers cycling IPs (rate limits by email)
// or cycling emails (rate limits by IP).
// ─────────────────────────────────────────────
export async function checkAuthLimit(
  limiter: Ratelimit | null,
  ip: string,
  email?: string | null
): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!limiter) return { allowed: true, retryAfter: 0 }
  const ipCheck    = await checkLimit(limiter, `ip:${ip}`)
  if (!ipCheck.allowed) return ipCheck
  if (email) {
    const emailCheck = await checkLimit(limiter, `email:${email.toLowerCase()}`)
    if (!emailCheck.allowed) return emailCheck
  }
  return { allowed: true, retryAfter: 0 }
}
