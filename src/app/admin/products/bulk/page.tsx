// /admin/products/bulk — bulk product import

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import BulkForm from './BulkForm'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function BulkImportPage() {
  await requireAdmin()
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/products" suffix="Admin" />
        <Link href="/admin/products" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All products
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Bulk Import
              </span>
            </div>
            <h1 className="font-display font-black leading-none mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)' }}>
              Add Many<br /><em style={{ color: 'var(--color-accent)' }}>Products at Once.</em>
            </h1>
            <p className="text-sm mt-4 max-w-2xl" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
              Type the products row by row, then save them all in one go.
              Images get added separately from the products list once you&apos;ve created the items.
            </p>
          </div>

          <BulkForm />
        </div>
      </div>
    </main>
  )
}
