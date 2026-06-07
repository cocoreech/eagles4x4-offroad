// ============================================================
// Input sanitization helpers
// ============================================================
// Defense-in-depth for any text that gets stored or echoed back.
// Apply in server actions, NEVER trust the client.
//
// What it protects against:
//   - NULL byte injection (some Postgres versions choke on \0)
//   - Zero-width / bidi control characters (homoglyph & RTL-override attacks)
//   - Unicode normalization tricks (different bytes that render identically)
//   - Length-based denial of service
//
// What it does NOT do (handled elsewhere):
//   - XSS escape: React auto-escapes on render — safe by default
//   - SQL injection: Supabase parameterized queries — safe by default
//   - Prompt injection: when we wire up AI, that prompt builder must
//     ALSO call sanitizeForPrompt() on any user-provided text

// Categories of dangerous unicode (control chars + bidi + zero-width).
// Written as \u escapes (not literal control bytes) so the source stays
// readable and the intent of each range is explicit.
const DANGEROUS_RANGES = [
  /\u0000-\u0008/,  // C0 controls (NULL etc.) - \t, \n preserved
  /\u000B-\u000C/,  // VT, FF
  /\u000E-\u001F/,  // C0 controls - \r preserved
  /\u007F/,         // DEL
  /\u0080-\u009F/,  // C1 controls
  /\u200B-\u200F/,  // zero-width space + LTR/RTL marks
  /\u202A-\u202E/,  // bidi overrides
  /\u2060-\u2069/,  // word joiner + bidi isolate
  /\uFEFF/,         // BOM
]
const STRIP_PATTERN = new RegExp(
  '[' + DANGEROUS_RANGES.map(r => r.source).join('') + ']',
  'g'
)

/**
 * Clean a string for safe storage and downstream display.
 *  - Strips control + invisible characters
 *  - Trims surrounding whitespace
 *  - Normalizes unicode to NFC (canonical form — avoids homoglyph stuffing)
 *  - Caps at maxLength
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  if (input == null) return ''
  // Objects/functions have no meaningful text form (would stringify to
  // "[object Object]" etc.) — treat them as empty rather than store garbage.
  if (typeof input === 'object' || typeof input === 'function') return ''
  const raw = String(input)
  const cleaned = raw
    .normalize('NFC')
    .replace(STRIP_PATTERN, '')
    .trim()
  return cleaned.slice(0, maxLength)
}

/**
 * Extra-paranoid sanitizer for text that will be fed into an AI prompt.
 * Adds protection against prompt-injection attempts.
 *
 * IMPORTANT: Call this whenever user-provided text gets concatenated into
 * an OpenAI/Anthropic prompt. It does NOT make AI fully safe — also use
 * system-role separation, and keep the user content INSIDE a labeled
 * delimiter block ("Customer wrote: <<< ... >>>").
 */
export function sanitizeForPrompt(input: unknown, maxLength = 1000): string {
  const cleaned = sanitizeText(input, maxLength)
  // Defang common prompt-injection patterns. Real protection is structural
  // (clear system/user message separation) — this just makes naive attempts
  // less effective.
  return cleaned
    .replace(/ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?)/gi, '[redacted]')
    .replace(/system\s*:/gi, '[redacted]:')
    .replace(/```[\s\S]*?```/g, '[code block removed]')
}

/**
 * Sanitize text but PRESERVE newlines (for multi-line notes/messages).
 * Otherwise the strip is identical to sanitizeText.
 */
export function sanitizeMultiline(input: unknown, maxLength = 4000): string {
  if (input == null) return ''
  if (typeof input === 'object' || typeof input === 'function') return ''
  const raw = String(input)
  const cleaned = raw
    .normalize('NFC')
    // Allow \n and \t but strip other controls
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replaceAll('\r\n', '\n') // Normalize line endings
    .replaceAll('\r', '\n')
    .trim()
  return cleaned.slice(0, maxLength)
}
