'use client'

import { useState, useTransition } from 'react'
import { adminLogin } from './actions'
import PasswordInput from '@/components/PasswordInput'
import { BRANCHES } from '@/content/branches'

export default function AdminLoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await adminLogin(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-md p-7 space-y-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <label className="block">
        <span
          className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@eagles4x4.ph"
          className="w-full px-4 py-3 rounded-sm outline-none transition text-sm"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      </label>

      <PasswordInput
        name="password"
        label="Password"
        autoComplete="current-password"
        minLength={8}
      />

      <label className="block">
        <span
          className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Branch
        </span>
        <select
          name="branch"
          defaultValue=""
          className="w-full px-4 py-3 rounded-sm outline-none transition text-sm"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            colorScheme: 'dark',
          }}
        >
          <option value="">— Select your branch —</option>
          {BRANCHES.map(b => (
            <option key={b.slug} value={b.slug}>{b.name}</option>
          ))}
        </select>
        <span className="block text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
          Assigned once on your first sign-in. Super admins can leave this blank.
        </span>
      </label>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        {pending ? 'Signing in…' : 'Continue →'}
      </button>
    </form>
  )
}
