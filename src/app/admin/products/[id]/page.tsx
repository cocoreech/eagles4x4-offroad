// /admin/products/[id] — edit an existing product

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import ProductForm from '../ProductForm'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdmin()
  const supabase = createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!product) notFound()

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/products" suffix="Admin" />
        <Link href="/admin/products" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All products
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Edit Product
              </span>
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)' }}>
              {product.name}
            </h1>
          </div>
          <ProductForm initial={product} />
        </div>
      </div>
    </main>
  )
}
