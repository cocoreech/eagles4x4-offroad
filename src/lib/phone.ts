// ============================================================
// Phone number helpers
// ============================================================
// Defaults to Philippine mobile (most customers), but supports
// other country codes for foreign clients.
//
// All numbers are stored in E.164 format internally: +<country><digits>
// e.g. "+639171234567" for a PH mobile.

// Accepted PH formats (normalized to "09XXXXXXXXX" → display, "+639XXXXXXXXX" → storage):
//   09171234567        ← canonical
//   0917-123-4567      ← dashes
//   0917 123 4567      ← spaces
//   +639171234567      ← international
//   639171234567       ← international without +

const PH_MOBILE_REGEX = /^09\d{9}$/  // 09 + 9 digits = 11 total

// ── COUNTRY CODE OPTIONS ──
// Common dialing codes shown in the country selector. Add more as needed.
export type CountryCode = {
  dial: string          // "+63"
  iso: string           // "PH"
  name: string          // "Philippines"
  flag: string          // 🇵🇭
  expectedLength: number  // digits after country code (e.g. PH mobile = 10)
}

export const COUNTRY_CODES: CountryCode[] = [
  // Philippines first (default)
  { dial: '+63',  iso: 'PH', name: 'Philippines',   flag: '🇵🇭', expectedLength: 10 },
  // ASEAN
  { dial: '+65',  iso: 'SG', name: 'Singapore',     flag: '🇸🇬', expectedLength: 8 },
  { dial: '+60',  iso: 'MY', name: 'Malaysia',      flag: '🇲🇾', expectedLength: 10 },
  { dial: '+66',  iso: 'TH', name: 'Thailand',      flag: '🇹🇭', expectedLength: 9 },
  { dial: '+62',  iso: 'ID', name: 'Indonesia',     flag: '🇮🇩', expectedLength: 10 },
  { dial: '+84',  iso: 'VN', name: 'Vietnam',       flag: '🇻🇳', expectedLength: 9 },
  { dial: '+673', iso: 'BN', name: 'Brunei',        flag: '🇧🇳', expectedLength: 7 },
  // Major OFW destinations
  { dial: '+1',   iso: 'US', name: 'USA / Canada',  flag: '🇺🇸', expectedLength: 10 },
  { dial: '+971', iso: 'AE', name: 'UAE',           flag: '🇦🇪', expectedLength: 9 },
  { dial: '+966', iso: 'SA', name: 'Saudi Arabia',  flag: '🇸🇦', expectedLength: 9 },
  { dial: '+61',  iso: 'AU', name: 'Australia',     flag: '🇦🇺', expectedLength: 9 },
  { dial: '+852', iso: 'HK', name: 'Hong Kong',     flag: '🇭🇰', expectedLength: 8 },
  { dial: '+81',  iso: 'JP', name: 'Japan',         flag: '🇯🇵', expectedLength: 10 },
  { dial: '+82',  iso: 'KR', name: 'South Korea',   flag: '🇰🇷', expectedLength: 10 },
  { dial: '+44',  iso: 'GB', name: 'United Kingdom',flag: '🇬🇧', expectedLength: 10 },
  { dial: '+49',  iso: 'DE', name: 'Germany',       flag: '🇩🇪', expectedLength: 10 },
]

export const DEFAULT_COUNTRY = COUNTRY_CODES[0]  // PH

// Look up a country code by dial string ("+63" → CountryCode)
export function getCountryByDial(dial: string): CountryCode | null {
  return COUNTRY_CODES.find(c => c.dial === dial) ?? null
}

/**
 * Strip everything that isn't a digit or '+'.
 */
function stripFormatting(input: string): string {
  return input.replace(/[^\d+]/g, '')
}

/**
 * Normalize an input to canonical PH mobile form: 09XXXXXXXXX
 * Returns null if input cannot be normalized.
 */
export function normalizePhMobile(input: string | null | undefined): string | null {
  if (!input) return null
  let s = stripFormatting(input)

  // Strip leading + (we'll process the country code)
  if (s.startsWith('+')) s = s.slice(1)

  // 639XXXXXXXXX -> 09XXXXXXXXX  (12 digits with 63 country code)
  if (s.length === 12 && s.startsWith('63')) s = '0' + s.slice(2)
  // 9XXXXXXXXX -> 09XXXXXXXXX     (10 digits, missing leading 0)
  if (s.length === 10 && s.startsWith('9')) s = '0' + s

  return PH_MOBILE_REGEX.test(s) ? s : null
}

/**
 * Display formatter: 09171234567 -> 0917 123 4567
 */
export function formatPhMobile(input: string | null | undefined): string {
  const normalized = normalizePhMobile(input)
  if (!normalized) return input ?? ''
  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`
}

/**
 * True if the input is a valid PH mobile (any accepted format).
 */
export function isValidPhMobile(input: string | null | undefined): boolean {
  return normalizePhMobile(input) !== null
}

// ─────────────────────────────────────────────
// International phone normalization (E.164 format)
// ─────────────────────────────────────────────
/**
 * Normalize "<dial> <localDigits>" into E.164: "+<dial><digits>"
 * Used when the booking form provides BOTH a country code AND a number.
 * Returns null if the number doesn't match the expected length for the
 * country.
 */
export function normalizeE164(dial: string, localNumber: string): string | null {
  const country = getCountryByDial(dial)
  if (!country) return null

  // Strip all non-digits from the local part
  let digits = localNumber.replace(/\D/g, '')

  // Common quirk: PH users type "0917..." — strip the leading 0.
  if (country.iso === 'PH' && digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.length !== country.expectedLength) return null

  return `${country.dial}${digits}`
}

/**
 * True if "<dial>" + "<localNumber>" forms a valid number for that country.
 */
export function isValidInternational(dial: string, localNumber: string): boolean {
  return normalizeE164(dial, localNumber) !== null
}
