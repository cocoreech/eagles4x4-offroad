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

// Dangerous unicode code-point ranges (C0/C1 control chars + bidi + zero-width).
// Expressed as numbers and compiled to a regex character class at module load.
// Building from code points (rather than control characters in a regex literal)
// keeps the source free of invisible bytes and lets static analyzers see intent.
// TAB (0x09), LF (0x0A) and CR (0x0D) are deliberately NOT stripped.
const STRIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x08],     // C0 controls (NUL..BS)
  [0x0b, 0x0c],     // VT, FF
  [0x0e, 0x1f],     // remaining C0 controls
  [0x7f, 0x9f],     // DEL + C1 controls
  [0x200b, 0x200f], // zero-width space + LTR/RTL marks
  [0x202a, 0x202e], // bidi overrides
  [0x2060, 0x2069], // word joiner + bidi isolates
  [0xfeff, 0xfeff], // BOM / zero-width no-break space
]

function codePointClass(ranges: ReadonlyArray<readonly [number, number]>): string {
  const ch = (n: number) => String.fromCodePoint(n)
  return ranges.map(([a, b]) => (a === b ? ch(a) : `${ch(a)}-${ch(b)}`)).join('')
}

const STRIP_PATTERN = new RegExp('[' + codePointClass(STRIP_RANGES) + ']', 'g')

// Coerce arbitrary input to a string WITHOUT relying on Object's default
// "[object Object]" stringification. Only genuine primitives become text;
// objects, arrays, functions, symbols, null and undefined yield ''.
function toText(input: unknown): string {
  if (typeof input === 'string') return input
  if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
    return String(input)
  }
  return ''
}

/**
 * Clean a string for safe storage and downstream display.
 *  - Strips control + invisible characters
 *  - Trims surrounding whitespace
 *  - Normalizes unicode to NFC (canonical form — avoids homoglyph stuffing)
 *  - Caps at maxLength
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  const cleaned = toText(input)
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
  const cleaned = toText(input)
    .normalize('NFC')
    .replace(STRIP_PATTERN, '') // strips controls; \t, \n, \r survive
    .replaceAll('\r\n', '\n') // normalize line endings
    .replaceAll('\r', '\n')
    .trim()
  return cleaned.slice(0, maxLength)
}
