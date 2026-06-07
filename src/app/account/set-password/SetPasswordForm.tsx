'use client'

import { useState, useTransition } from 'react'
import { setPassword } from './actions'
import PasswordInput from '@/components/PasswordInput'

export default function SetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await setPassword(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form
      action={handleSubmit}
      className="rounded-md p-7 space-y-5"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <PasswordInput
        name="password"
        label="New Password"
        autoComplete="new-password"
        minLength={12}
        autoFocus
      />
      <PasswordInput
        name="confirm"
        label="Confirm Password"
        autoComplete="new-password"
        minLength={12}
      />

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        {pending ? 'Saving…' : 'Save Password'}
      </button>
    </form>
  )
}
