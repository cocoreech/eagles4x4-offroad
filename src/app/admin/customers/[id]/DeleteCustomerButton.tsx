'use client'

import { useState, useTransition } from 'react'
import { deleteCustomerAccount } from './actions'

export default function DeleteCustomerButton({ customerId }: Readonly<{ customerId: string }>) {
  const [armed, setArmed] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await deleteCustomerAccount(formData)
      if (res?.error) setError(res.error)
    })
  }

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="rounded-sm px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em]"
        style={{ border: '1px solid var(--color-destructive)', color: 'var(--color-destructive)' }}
      >
        Delete account
      </button>
    )
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="text-sm" style={{ color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
        Permanently delete this customer. Their profile, vehicles, chats, and feedback are erased;
        past bookings are kept but unlinked and scrubbed. This cannot be undone.
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
          className="w-full rounded-sm px-4 py-2 text-sm outline-none"
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
          className="rounded-sm px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] transition disabled:opacity-40"
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
          className="rounded-sm px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.15em] disabled:opacity-40"
          style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
