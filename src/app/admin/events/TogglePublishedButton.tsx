'use client'

import { useTransition } from 'react'
import { publishEvent, unpublishEvent } from './actions'

export default function TogglePublishedButton({ id, isPublished }: Readonly<{ id: string; isPublished: boolean }>) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      if (isPublished) await unpublishEvent(fd)
      else             await publishEvent(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full disabled:opacity-50"
      style={{
        background: isPublished ? 'rgba(34,197,94,0.12)' : 'rgba(136,136,136,0.12)',
        color:      isPublished ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
      }}
    >
      {pending ? '…' : isPublished ? '● Published' : '○ Draft'}
    </button>
  )
}
