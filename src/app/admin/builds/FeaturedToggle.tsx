'use client'

import { useTransition } from 'react'
import { setFeatured } from './actions'

export default function FeaturedToggle({ id, isFeatured }: { id: string; isFeatured: boolean }) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('isFeatured', String(!isFeatured))
    startTransition(async () => {
      await setFeatured(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full disabled:opacity-50"
      style={{
        background: isFeatured ? 'rgba(201,168,76,0.15)' : 'rgba(136,136,136,0.12)',
        color:      isFeatured ? 'var(--color-accent)' : 'var(--color-text-muted)',
      }}
    >
      {pending ? '…' : isFeatured ? '★ Featured' : '☆ Show'}
    </button>
  )
}
