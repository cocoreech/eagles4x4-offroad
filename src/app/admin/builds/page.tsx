// ============================================================
// /admin/builds — list builds
// ============================================================

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import InlineImageCell from '@/components/InlineImageCell'
import FeaturedToggle from './FeaturedToggle'
import { setBuildCoverImage } from './imageActions'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function AdminBuildsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: builds } = await supabase
    .from('builds')
    .select('id, slug, title, vehicle_make, vehicle_model, vehicle_year, location, cover_image_url, gallery_image_urls, is_featured, build_date')
    .order('is_featured', { ascending: false })
    .order('build_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

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
                  Builds Gallery
                </span>
              </div>
              <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
                Builds<em style={{ color: 'var(--color-accent)' }}>.</em>
              </h1>
            </div>
            <Link
              href="/admin/builds/new"
              className="px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              + Add Build
            </Link>
          </div>

          {!builds || builds.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No builds yet — click <strong style={{ color: 'var(--color-accent)' }}>Add Build</strong> to showcase your first project.
            </div>
          ) : (
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
                  <tr>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Cover</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Build</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Vehicle</th>
                    <th className="text-center p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Gallery</th>
                    <th className="text-center p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Featured</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map(b => (
                    <tr key={b.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="p-3 w-16">
                        <InlineImageCell
                          rowId={b.id}
                          initialUrl={b.cover_image_url}
                          folder="builds"
                          setImageAction={setBuildCoverImage}
                        />
                      </td>
                      <td className="p-3">
                        <Link href={`/admin/builds/${b.id}`} className="font-semibold">
                          {b.title}
                        </Link>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{b.slug}</div>
                      </td>
                      <td className="p-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {b.vehicle_year} {b.vehicle_make} {b.vehicle_model}
                      </td>
                      <td className="p-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {(b.gallery_image_urls?.length ?? 0)} photos
                      </td>
                      <td className="p-3 text-center">
                        <FeaturedToggle id={b.id} isFeatured={b.is_featured} />
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/builds/${b.id}`} className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                          Edit →
                        </Link>
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
