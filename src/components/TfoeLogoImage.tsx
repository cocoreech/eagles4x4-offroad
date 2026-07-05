'use client'

import { useState } from 'react'
import { brand } from '@/content/brand'

export function TfoeLogoImage() {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold tracking-widest"
        style={{
          background: 'rgba(201,168,76,0.12)',
          border: '2px solid rgba(201,168,76,0.4)',
          color: 'var(--color-accent)',
        }}
        aria-label={brand.organization_logo_alt}
      >
        TFOE
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.organization_logo}
      alt={brand.organization_logo_alt}
      className="w-20 h-20 rounded-full object-cover flex-shrink-0"
      style={{ border: '2px solid rgba(201,168,76,0.4)' }}
      onError={() => setFailed(true)}
    />
  )
}
