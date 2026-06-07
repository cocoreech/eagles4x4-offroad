'use client'

// ============================================================
// PhoneInput — country code dropdown + number input
// ============================================================
// Stores the normalized E.164 string ("+639171234567") in a hidden
// input. Server re-validates with normalizeE164() before insert.

import { useState } from 'react'
import { COUNTRY_CODES, DEFAULT_COUNTRY, getCountryByDial } from '@/lib/phone'

export default function PhoneInput({
  name = 'contactPhone',
  label = 'Mobile',
}: Readonly<{
  name?: string
  label?: string
}>) {
  const [dial, setDial] = useState<string>(DEFAULT_COUNTRY.dial)
  const [number, setNumber] = useState<string>('')

  const country = getCountryByDial(dial) ?? DEFAULT_COUNTRY

  // Build the E.164 value lazily — server will revalidate anyway.
  // For PH, strip the leading 0 if user typed "0917..."; for others, just use digits.
  const digits = number.replace(/\D/g, '')
  const localDigits = country.iso === 'PH' && digits.startsWith('0')
    ? digits.slice(1)
    : digits
  const e164 = localDigits.length === country.expectedLength
    ? `${country.dial}${localDigits}`
    : ''

  // Country-aware placeholder
  const placeholder = country.iso === 'PH'
    ? '0917 123 4567'
    : `${country.expectedLength} digits`

  return (
    <div>
      <span
        className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>

      <div className="flex gap-2">
        {/* Country code dropdown */}
        <select
          value={dial}
          onChange={(e) => setDial(e.target.value)}
          className="px-3 py-3 rounded-sm outline-none text-sm transition flex-shrink-0"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            colorScheme: 'dark',
            maxWidth: '130px',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          aria-label="Country code"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.dial + c.iso} value={c.dial}>
              {c.flag} {c.dial}
            </option>
          ))}
        </select>

        {/* Number input */}
        <input
          type="tel"
          inputMode="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={placeholder}
          required
          maxLength={20}
          className="flex-1 min-w-0 px-4 py-3 rounded-sm outline-none text-sm transition"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          aria-label="Phone number"
        />
      </div>

      {/* Live validation feedback */}
      {number && (
        <p
          className="mt-2 text-xs"
          style={{
            color: e164 ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
          }}
        >
          {e164
            ? `✓ ${e164}`
            : `Expected ${country.expectedLength} digits for ${country.name}`}
        </p>
      )}

      {/* Submitted value (server reads this) */}
      <input type="hidden" name={name} value={e164} />
      <input type="hidden" name={`${name}Dial`} value={dial} />
      <input type="hidden" name={`${name}Local`} value={number} />
    </div>
  )
}
