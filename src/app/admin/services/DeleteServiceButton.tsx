'use client'

import { useState, useTransition } from 'react'
import { deleteService } from './actions'

export default function DeleteServiceButton({ id, name }: Readonly<{ id: string; name: string }>) {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function handleDelete() {
    if (!window.confirm(`Delete "${name}"? Services with past bookings will be hidden instead of removed.`)) return
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      const res = await deleteService(fd)
      if (res.error) setMsg(res.error)
      else if (res.softened) setMsg('Hidden (has past bookings)')
      // hard-delete: the row disappears on revalidate; no message needed
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="text-xs font-bold tracking-widest uppercase disabled:opacity-50"
        style={{ color: 'var(--color-destructive)' }}
      >
        {pending ? '…' : 'Delete'}
      </button>
      {msg && <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{msg}</span>}
    </span>
  )
}
