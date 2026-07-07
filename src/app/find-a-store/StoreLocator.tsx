'use client'

// ============================================================
// StoreLocator — one map + branch list.
// ============================================================
// Selecting a branch re-points the map to it AND shows its details,
// simultaneously. Map uses Google's keyless embed (re-navigates on src change).

import { useState } from 'react'
import { mapsUrl, wazeUrl, mapsEmbedUrl, type Branch } from '@/content/branches'

export default function StoreLocator({ branches }: Readonly<{ branches: Branch[] }>) {
  const [selected, setSelected] = useState(0)
  const active = branches[selected] ?? branches[0]

  return (
    <div className="mb-16">
      {/* Map — re-points when the active branch changes */}
      <div
        className="rounded-sm overflow-hidden mb-4 aspect-[16/9] md:aspect-[16/7]"
        style={{ border: '1px solid rgba(201,168,76,0.25)', background: 'var(--color-surface)' }}
      >
        <iframe
          src={mapsEmbedUrl(active.address)}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Map — Eagles 4×4 Offroad ${active.name}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-4">
        {/* Branch list */}
        <div className="flex flex-col gap-2" role="tablist" aria-label="Branches">
          {branches.map((b, i) => {
            const isActive = i === selected
            return (
              <button
                key={b.name}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelected(i)}
                className="text-left rounded-sm p-4 transition focus:outline-none focus-visible:outline-2"
                style={{
                  background: isActive ? 'rgba(201,168,76,0.08)' : 'var(--color-surface)',
                  border: '1px solid ' + (isActive ? 'var(--color-accent)' : 'var(--color-border)'),
                  outlineColor: 'var(--color-accent)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className="text-[9px] font-bold uppercase mb-1"
                      style={{ color: 'var(--color-accent)', letterSpacing: '0.2em' }}
                    >
                      {b.region}
                    </div>
                    <div className="font-display font-bold text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                      {b.name}
                    </div>
                  </div>
                  <span
                    className="flex-shrink-0 text-sm"
                    style={{ color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted-2)' }}
                    aria-hidden
                  >
                    {isActive ? '📍' : '→'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Active branch details */}
        <div
          className="rounded-sm p-6 md:p-8"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
            {active.tag}
          </div>
          <h2 className="font-display font-black text-2xl md:text-3xl mb-5" style={{ fontFamily: 'var(--font-display)' }}>
            {active.name}
          </h2>

          <div className="space-y-2.5 text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <div className="flex items-start gap-2.5">
              <span aria-hidden>📍</span>
              <span>{active.address}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span aria-hidden>🕐</span>
              <span>{active.hours}</span>
            </div>
            {active.phone && (
              <div className="flex items-start gap-2.5">
                <span aria-hidden>📞</span>
                <a href={`tel:${active.phone.replace(/\s/g, '')}`} className="hover:underline">{active.phone}</a>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <span aria-hidden>✉️</span>
              <a href="mailto:hello@eagles4x4.ph" className="hover:underline">hello@eagles4x4.ph</a>
            </div>
            {active.facebook && (
              <div className="flex items-start gap-2.5">
                <span aria-hidden>📘</span>
                <a href={active.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Facebook Page
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={mapsUrl(active.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-[10px] font-extrabold uppercase rounded-sm text-center transition-all hover:brightness-110"
              style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
            >
              Get Directions
            </a>
            <a
              href={wazeUrl(active.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-[10px] font-semibold uppercase rounded-sm text-center transition-all"
              style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.12em' }}
            >
              Open in Waze
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
