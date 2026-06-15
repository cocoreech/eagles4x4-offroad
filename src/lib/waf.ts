// ============================================================
// waf.ts — lightweight in-house WAF (request attack-payload screen)
// ============================================================
// Runs in middleware BEFORE any route handler. Inspects the parts of a
// request an attacker controls and that aren't already covered elsewhere:
//   - URL pathname (scanner probes, path traversal)
//   - query-string values (SQLi / XSS reflected via GET params)
//   - a few header vectors that get echoed or logged (referer, x-forwarded-host)
//
// What it deliberately does NOT inspect:
//   - Request bodies — reading the body in middleware consumes the stream and
//     starves the downstream handler. Bodies are already validated with Zod and
//     cleaned via lib/sanitize.ts inside the route handlers / server actions.
//   - XSS in rendered output — React auto-escapes on render.
//   - SQL injection at the DB layer — Supabase uses parameterized queries.
//
// This is a complement to those defenses (defense-in-depth), not a replacement.
// Keep the signatures TIGHT: every pattern here must match real attack traffic
// and effectively never match legitimate booking/quote/contact input.

export interface WafVerdict {
  blocked: boolean
  reason?: string
}

// ─────────────────────────────────────────────
// Attack signatures
// ─────────────────────────────────────────────
// Each entry is [reasonLabel, pattern]. Patterns are case-insensitive and
// matched against percent-decoded strings (so %27 → ' is caught).

const SIGNATURES: ReadonlyArray<readonly [string, RegExp]> = [
  // ── SQL injection ──────────────────────────────────────────
  // Classic tautologies: ' or 1=1 , " or "a"="a , ) or (1=1
  ['sqli:tautology', /['")\s](?:or|and)\s+['"(\s]*\d+\s*=\s*\d+/i],
  // UNION-based extraction
  ['sqli:union', /\bunion\b[\s/*]+\bselect\b/i],
  // Schema probing / stacked queries
  ['sqli:schema', /\b(?:information_schema|pg_catalog|sqlite_master)\b/i],
  // Time-based blind probes
  ['sqli:timing', /\b(?:sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\(/i],
  // SQL comment terminators used to truncate a query
  ['sqli:comment', /(?:--\s|#\s|\/\*).*(?:\bor\b|\bunion\b|=)/i],

  // ── Cross-site scripting ───────────────────────────────────
  ['xss:script-tag', /<\s*script\b/i],
  ['xss:iframe', /<\s*iframe\b/i],
  ['xss:js-uri', /javascript\s*:/i],
  ['xss:event-handler', /\bon(?:error|load|click|mouseover|focus)\s*=/i],
  ['xss:svg-onload', /<\s*svg\b[^>]*\bon\w+\s*=/i],

  // ── Path traversal / local file access ─────────────────────
  ['traversal:dotdot', /(?:\.\.[/\\]){2,}/],
  ['traversal:etc-passwd', /\/etc\/passwd\b/i],
  ['traversal:win-ini', /\\windows\\win\.ini\b/i],

  // ── Command / template / null-byte injection ───────────────
  // \x00 matches a raw null byte; %00 catches the still-encoded form.
  ['injection:nullbyte', /\x00|%00/i],
  ['injection:template', /\$\{[^}]*(?:process|require|global|__proto__)/i],
  ['injection:shell', /[;|&`]\s*(?:cat|wget|curl|nc|bash|sh|powershell)\b/i],
]

// Decode percent-encoding defensively. A malformed sequence (e.g. a lone "%")
// throws in decodeURIComponent — fall back to the raw value so the literal
// signatures still get a chance to match rather than crashing the request.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function matchSignatures(haystack: string): string | null {
  for (const [reason, pattern] of SIGNATURES) {
    if (pattern.test(haystack)) return reason
  }
  return null
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Screen a request's URL and header vectors for attack payloads.
 *
 * @param pathname     req.nextUrl.pathname
 * @param searchParams req.nextUrl.searchParams
 * @param headers      req.headers
 * @returns a verdict; when blocked, `reason` names the matched signature.
 */
export function screenRequest(
  pathname: string,
  searchParams: URLSearchParams,
  headers: Headers,
): WafVerdict {
  // 1. Pathname — raw and decoded (scanners encode traversal as %2e%2e).
  const decodedPath = safeDecode(pathname)
  const pathHit = matchSignatures(pathname) ?? matchSignatures(decodedPath)
  if (pathHit) return { blocked: true, reason: `path:${pathHit}` }

  // 2. Query-string VALUES (URLSearchParams already decodes once; decode again
  //    to catch double-encoding). Keys are ignored — they're rarely the vector.
  for (const value of searchParams.values()) {
    const hit = matchSignatures(value) ?? matchSignatures(safeDecode(value))
    if (hit) return { blocked: true, reason: `query:${hit}` }
  }

  // 3. Header vectors that commonly get reflected, stored, or logged.
  for (const name of ['referer', 'x-forwarded-host', 'x-original-url']) {
    const value = headers.get(name)
    if (!value) continue
    const hit = matchSignatures(value) ?? matchSignatures(safeDecode(value))
    if (hit) return { blocked: true, reason: `header:${name}:${hit}` }
  }

  return { blocked: false }
}
