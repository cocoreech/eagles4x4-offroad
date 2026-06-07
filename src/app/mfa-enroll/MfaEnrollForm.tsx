'use client'

import { useState, useTransition } from 'react'
import { verifyEnrollment } from './actions'

export default function MfaEnrollForm({ factorId }: { factorId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await verifyEnrollment(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <label className="block">
        <span
          className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          6-Digit Code from App
        </span>
        <input
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{4,8}"
          maxLength={8}
          required
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          className="w-full px-4 py-3 rounded-sm outline-none transition text-center text-2xl font-mono"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            letterSpacing: '0.5em',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      </label>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        {pending ? 'Verifying…' : 'Verify & Enable MFA'}
      </button>
    </form>
  )
}
