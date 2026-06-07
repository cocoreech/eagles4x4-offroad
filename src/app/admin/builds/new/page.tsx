// /admin/builds/new — add a new build

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import BuildForm from '../BuildForm'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function NewBuildPage() {
  await requireAdmin()
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/builds" suffix="Admin" />
        <Link href="/admin/builds" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All builds
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                New Build
              </span>
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)' }}>
              Add a<br /><em style={{ color: 'var(--color-accent)' }}>Build.</em>
            </h1>
          </div>
          <BuildForm />
        </div>
      </div>
    </main>
  )
}
