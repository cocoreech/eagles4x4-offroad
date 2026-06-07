'use client'

import { useTransition } from 'react'
import { activateProduct, deactivateProduct } from './actions'

export default function ToggleActiveButton({ id, isActive }: Readonly<{ id: string; isActive: boolean }>) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(async () => {
      if (isActive) await deactivateProduct(fd)
      else          await activateProduct(fd)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full disabled:opacity-50"
      style={{
        background: isActive ? 'rgba(34,197,94,0.12)' : 'rgba(136,136,136,0.12)',
        color:      isActive ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
      }}
    >
      {pending ? '…' : isActive ? '● Active' : '○ Inactive'}
    </button>
  )
}
