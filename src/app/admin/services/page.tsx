// ============================================================
// /admin/services — list + activate/deactivate
// ============================================================

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import ToggleActiveButton from './ToggleActiveButton'
import InlineImageCell from '@/components/InlineImageCell'
import { setServiceImage } from './actions'
import DeleteServiceButton from './DeleteServiceButton'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function AdminServicesPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: services } = await supabase
    .from('services')
    .select('id, slug, name, category, starting_price, icon, image_url, is_active, display_order')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin" suffix="Admin" />
        <Link href="/admin" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Admin home
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
                <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                  Services Catalog
                </span>
              </div>
              <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
                Services<em style={{ color: 'var(--color-accent)' }}>.</em>
              </h1>
            </div>
            <Link
              href="/admin/services/new"
              className="px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              + Add Service
            </Link>
          </div>

          {/* Table */}
          {!services || services.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No services yet — click <strong style={{ color: 'var(--color-accent)' }}>Add Service</strong> to create the first one.
            </div>
          ) : (
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
                  <tr>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Image</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Name</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Category</th>
                    <th className="text-right p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>From</th>
                    <th className="text-center p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Active</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(s => (
                    <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="p-3 w-16">
                        <InlineImageCell
                          rowId={s.id}
                          initialUrl={s.image_url}
                          folder="services"
                          setImageAction={setServiceImage}
                        />
                      </td>
                      <td className="p-3">
                        <Link href={`/admin/services/${s.id}`} className="font-semibold" style={{ color: s.is_active ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                          {s.name}
                        </Link>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{s.slug}</div>
                      </td>
                      <td className="p-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {s.category.replace('-', ' ')}
                      </td>
                      <td className="p-3 text-right font-mono text-xs" style={{ color: 'var(--color-accent)' }}>
                        ₱{Number(s.starting_price).toLocaleString('en-PH')}
                      </td>
                      <td className="p-3 text-center">
                        <ToggleActiveButton id={s.id} isActive={s.is_active} />
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/services/${s.id}`} className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                          Edit →
                        </Link>
                        <span className="ml-3">
                          <DeleteServiceButton id={s.id} name={s.name} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
