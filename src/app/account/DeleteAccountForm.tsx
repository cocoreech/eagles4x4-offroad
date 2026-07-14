'use client'

import { useState, useTransition } from 'react'
import { deleteMyAccount } from './actions'

export default function DeleteAccountForm() {
  const [armed, setArmed] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await deleteMyAccount(formData)
      // On success the action redirects; we only get here on error.
      if (res?.error) setError(res.error)
    })
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-sm px-5 py-3 text-xs font-extrabold uppercase tracking-[0.15em] transition"
        style={{ border: '1px solid var(--color-destructive)', color: 'var(--color-destructive)' }}
      >
        Delete my account
      </button>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
        This permanently deletes your account, vehicles, chat history, and feedback. It cannot be
        undone. Your past booking records are kept by the shop but no longer linked to you.
      </p>
      <label className="block">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-muted)' }}>
          Type DELETE to confirm
        </span>
        <input
          name="confirm"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="off"
          className="w-full rounded-sm px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
      </label>

      {error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || confirm !== 'DELETE'}
          className="rounded-sm px-5 py-3 text-xs font-extrabold uppercase tracking-[0.15em] transition disabled:opacity-40"
          style={{ background: 'var(--color-destructive)', color: '#fff' }}
        >
          {pending ? 'Deleting…' : 'Permanently delete'}
        </button>
        <button
          type="button"
          onClick={() => {
            setArmed(false)
            setConfirm('')
            setError(null)
          }}
          disabled={pending}
          className="rounded-sm px-5 py-3 text-xs font-extrabold uppercase tracking-[0.15em] disabled:opacity-40"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
