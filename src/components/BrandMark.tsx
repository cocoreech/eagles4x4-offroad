// ============================================================
// BrandMark — consistent "Eagles 4×4" logo + wordmark
// ============================================================
// Used in every page header so the brand mark is identical
// across public, customer-account, and admin surfaces.
//
// Pass `suffix="Admin"` (or similar) to add a tracking-widest
// uppercase tag after the wordmark.

import Link from 'next/link'
import { brand } from '@/content/brand'

export default function BrandMark({
  href = '/',
  suffix,
}: Readonly<{
  href?: string
  suffix?: string
}>) {
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
        style={{ border: '2px solid var(--color-accent)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.logo}
          alt={brand.logo_alt}
          className="w-full h-full object-cover"
        />
      </div>
      <span
        className="font-brand text-xl md:text-2xl font-bold leading-none"
        style={{ letterSpacing: '0.06em' }}
      >
        {brand.name} <span style={{ color: 'var(--color-accent)' }}>4×4</span>
        {suffix && (
          <span
            className="ml-3 text-[10px] tracking-[0.22em] uppercase font-bold align-middle"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {suffix}
          </span>
        )}
      </span>
    </Link>
  )
}
