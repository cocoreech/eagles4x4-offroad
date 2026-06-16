'use client'

// ============================================================
// QuoteCalculator — public services + products picker
// ============================================================
// - Two tabs: Services (starting price) and Products (fixed price)
// - Adds picks to a running cart in the sidebar
// - "Proceed to Book" stores cart in sessionStorage and routes
//   to /bookings/new — pushing through /login if not signed in.
//
// Cart contract (kept in sync with /bookings/new prefill reader):
//   sessionStorage key:   'eagles4x4.quote'
//   shape:                { services: string[]; products: string[] }
// We store *slugs only* so the booking page re-fetches authoritative
// prices server-side — never trust client-supplied prices.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Service = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string | null
  icon: string | null
  starting_price: number | null
  image_url: string | null
}

type Product = {
  id: string
  slug: string
  name: string
  brand: string | null
  description: string | null
  category: string | null
  price: number | null
  image_url: string | null
}

type Props = {
  services: Service[]
  products: Product[]
  isSignedIn: boolean
}

const QUOTE_KEY = 'eagles4x4.quote'

export default function QuoteCalculator({ services, products, isSignedIn }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'services' | 'products'>('services')
  const [pickedServices, setPickedServices] = useState<Set<string>>(new Set())
  const [pickedProducts, setPickedProducts] = useState<Set<string>>(new Set())

  // Hydrate from sessionStorage so users can come back to the page
  // and still see their picks before sign-in.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUOTE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { services?: string[]; products?: string[] }
      if (Array.isArray(parsed.services)) setPickedServices(new Set(parsed.services))
      if (Array.isArray(parsed.products)) setPickedProducts(new Set(parsed.products))
    } catch {
      // ignore — corrupt cart shouldn't break the page
    }
  }, [])

  // Persist on every change.
  useEffect(() => {
    const payload = {
      services: Array.from(pickedServices),
      products: Array.from(pickedProducts),
    }
    try {
      sessionStorage.setItem(QUOTE_KEY, JSON.stringify(payload))
    } catch {
      // sessionStorage can throw in private mode — non-fatal
    }
  }, [pickedServices, pickedProducts])

  const toggleService = (slug: string) => {
    setPickedServices(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }
  const toggleProduct = (slug: string) => {
    setPickedProducts(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug); else next.add(slug)
      return next
    })
  }

  // Running estimate — services are "starting from", products are fixed.
  // We label this clearly so customers don't expect an exact total.
  const { servicesTotal, productsTotal, hasService } = useMemo(() => {
    const sTotal = services
      .filter(s => pickedServices.has(s.slug))
      .reduce((sum, s) => sum + Number(s.starting_price ?? 0), 0)
    const pTotal = products
      .filter(p => pickedProducts.has(p.slug))
      .reduce((sum, p) => sum + Number(p.price ?? 0), 0)
    return { servicesTotal: sTotal, productsTotal: pTotal, hasService: pickedServices.size > 0 }
  }, [services, products, pickedServices, pickedProducts])

  const grandTotal = servicesTotal + productsTotal
  const itemCount = pickedServices.size + pickedProducts.size

  const proceed = () => {
    if (itemCount === 0) return
    // Cart already lives in sessionStorage. Just route.
    const target = '/bookings/new?from=quote'
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(target)}`)
    } else {
      router.push(target)
    }
  }

  const clear = () => {
    setPickedServices(new Set())
    setPickedProducts(new Set())
  }

  // Group products by category for the showcase grid
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>()
    for (const p of products) {
      const cat = p.category ?? 'Other'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    return map
  }, [products])

  return (
    <>
    {/* ── Product Showcase ─────────────────────────────────────── */}
    {products.length > 0 && (
      <section
        id="products"
        className="px-6 md:px-12 pb-20 pt-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Products &amp; Accessories
              </span>
            </div>
            <h2
              className="font-display font-black leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 3.5vw, 48px)' }}
            >
              Shop by <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Category.</em>
            </h2>
            <p className="mt-2 text-sm max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
              Tap any item to add it to your quote. Mix services and parts for a full build estimate.
            </p>
          </div>

          {Array.from(productsByCategory.entries()).map(([cat, catProducts]) => (
            <div key={cat} className="mb-12">
              <div className="flex items-center gap-4 mb-5">
                <span
                  className="text-[10px] font-extrabold uppercase tracking-[0.25em]"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {cat}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {catProducts.map(p => (
                  <ProductShowcaseCard
                    key={p.id}
                    product={p}
                    picked={pickedProducts.has(p.slug)}
                    onToggle={() => toggleProduct(p.slug)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    {/* ── Quote Builder ─────────────────────────────────────────── */}
    <section id="services" className="px-6 md:px-12 pb-16 pt-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Left — picker */}
        <div>
          {/* Tabs */}
          <div className="flex gap-2 mb-6" role="tablist">
            <TabBtn active={tab === 'services'} onClick={() => setTab('services')} count={pickedServices.size}>
              Services
            </TabBtn>
            <TabBtn active={tab === 'products'} onClick={() => setTab('products')} count={pickedProducts.size}>
              Products
            </TabBtn>
          </div>

          {tab === 'services' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {services.length === 0 && <EmptyState label="No services available yet." />}
              {services.map(s => (
                <PickCard
                  key={s.id}
                  picked={pickedServices.has(s.slug)}
                  onClick={() => toggleService(s.slug)}
                  title={s.name}
                  meta={s.category ?? undefined}
                  desc={s.description}
                  priceLabel={s.starting_price != null ? `From ₱${Number(s.starting_price).toLocaleString('en-PH')}` : 'Quoted'}
                  imageUrl={s.image_url}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {products.length === 0 && <EmptyState label="No products available yet." />}
              {products.map(p => (
                <PickCard
                  key={p.id}
                  picked={pickedProducts.has(p.slug)}
                  onClick={() => toggleProduct(p.slug)}
                  title={p.name}
                  meta={[p.brand, p.category].filter(Boolean).join(' · ') || undefined}
                  desc={p.description}
                  priceLabel={p.price != null ? `₱${Number(p.price).toLocaleString('en-PH')}` : 'Inquire'}
                  imageUrl={p.image_url}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — sticky cart */}
        <aside>
          <div
            className="rounded-md p-6 sticky top-24"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="text-[10px] font-extrabold tracking-[0.4em] uppercase mb-4" style={{ color: 'var(--color-accent)' }}>
              Your Quote
            </div>

            {itemCount === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                Tap a service or product to add it. Your running estimate appears here.
              </p>
            ) : (
              <>
                {/* Scrollable item list — keeps the total + CTA in view no
                    matter how many items are picked. */}
                <div className="max-h-[48vh] overflow-y-auto -mr-3 pr-3">
                {pickedServices.size > 0 && (
                  <CartSection label="Services">
                    {services.filter(s => pickedServices.has(s.slug)).map(s => (
                      <CartRow
                        key={s.id}
                        name={s.name}
                        priceLabel={s.starting_price != null ? `from ₱${Number(s.starting_price).toLocaleString('en-PH')}` : 'Quoted'}
                        onRemove={() => toggleService(s.slug)}
                      />
                    ))}
                  </CartSection>
                )}
                {pickedProducts.size > 0 && (
                  <CartSection label="Products">
                    {products.filter(p => pickedProducts.has(p.slug)).map(p => (
                      <CartRow
                        key={p.id}
                        name={p.name}
                        priceLabel={p.price != null ? `₱${Number(p.price).toLocaleString('en-PH')}` : 'Inquire'}
                        onRemove={() => toggleProduct(p.slug)}
                      />
                    ))}
                  </CartSection>
                )}
                </div>

                <div
                  className="mt-5 pt-5 flex items-baseline justify-between"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
                    {hasService ? 'Estimate' : 'Subtotal'}
                  </span>
                  <span
                    className="font-display font-black text-2xl"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                  >
                    ₱{Math.round(grandTotal).toLocaleString('en-PH')}
                  </span>
                </div>
                {hasService && (
                  <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                    Services are <em>starting from</em>. Final price confirmed after inspection.
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              onClick={proceed}
              disabled={itemCount === 0}
              className="mt-6 w-full px-5 py-4 text-[11px] font-extrabold tracking-[0.14em] uppercase rounded-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              {isSignedIn ? 'Proceed to Book →' : 'Sign in to Book →'}
            </button>

            {itemCount > 0 && (
              <button
                type="button"
                onClick={clear}
                className="mt-3 w-full text-[10px] font-bold tracking-[0.18em] uppercase transition"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Clear all
              </button>
            )}

            <p className="mt-5 text-[10px] tracking-wider" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Booking confirmed with a <strong style={{ color: 'var(--color-accent)' }}>₱500 deposit</strong>. Balance paid at the shop.
            </p>
          </div>
        </aside>
      </div>
    </section>
    </>
  )
}

// ----------------- small presentational helpers ----------------- //

function TabBtn({
  active, onClick, count, children,
}: Readonly<{ active: boolean; onClick: () => void; count: number; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="px-5 py-3 text-[11px] font-extrabold tracking-[0.14em] uppercase rounded-sm transition"
      style={{
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? '#000' : 'var(--color-text-muted)',
        border: '1px solid ' + (active ? 'var(--color-accent)' : 'var(--color-border)'),
      }}
    >
      {children}
      {count > 0 && (
        <span
          className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-extrabold rounded-full"
          style={{
            background: active ? '#000' : 'var(--color-accent)',
            color: active ? 'var(--color-accent)' : '#000',
          }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function PickCard({
  picked, onClick, title, meta, desc, priceLabel, imageUrl,
}: Readonly<{
  picked: boolean
  onClick: () => void
  title: string
  meta?: string
  desc: string | null
  priceLabel: string
  imageUrl: string | null
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      className="text-left rounded-md p-4 transition focus:outline-none"
      style={{
        background: picked ? 'rgba(201,168,76,0.08)' : 'var(--color-surface)',
        border: '1px solid ' + (picked ? 'var(--color-accent)' : 'var(--color-border)'),
      }}
    >
      <div className="flex items-start gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="w-14 h-14 rounded-sm object-cover flex-shrink-0"
            style={{ border: '1px solid var(--color-border)' }}
          />
        ) : (
          <div
            className="w-14 h-14 rounded-sm flex-shrink-0 flex items-center justify-center font-display font-black text-xl"
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            {title.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {meta && (
            <div className="text-[9px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {meta}
            </div>
          )}
          <div className="font-display font-bold text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </div>
          {desc && (
            <p className="mt-1.5 text-[12px] line-clamp-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
              {desc}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-accent)' }}>
          {priceLabel}
        </span>
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[14px] font-black"
          style={{
            background: picked ? 'var(--color-accent)' : 'transparent',
            color: picked ? '#000' : 'var(--color-accent)',
            border: '1.5px solid var(--color-accent)',
          }}
          aria-hidden
        >
          {picked ? '✓' : '+'}
        </span>
      </div>
    </button>
  )
}

function CartSection({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="mb-4">
      <div className="text-[9px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function CartRow({ name, priceLabel, onRemove }: Readonly<{ name: string; priceLabel: string; onRemove: () => void }>) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-tight truncate">{name}</div>
        <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{priceLabel}</div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="text-[10px] font-bold tracking-widest uppercase flex-shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
      >
        ✕
      </button>
    </div>
  )
}

function EmptyState({ label }: Readonly<{ label: string }>) {
  return (
    <div
      className="col-span-full text-center p-8 rounded-md text-[13px]"
      style={{
        background: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
        color: 'var(--color-text-muted)',
      }}
    >
      {label}
    </div>
  )
}

function ProductShowcaseCard({
  product,
  picked,
  onToggle,
}: Readonly<{ product: Product; picked: boolean; onToggle: () => void }>) {
  const priceLabel = product.price != null
    ? `₱${Number(product.price).toLocaleString('en-PH')}`
    : 'Inquire'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      className="group text-left rounded-sm overflow-hidden transition focus:outline-none focus-visible:outline-2"
      style={{
        background: picked ? 'rgba(201,168,76,0.08)' : 'var(--color-surface)',
        border: '1px solid ' + (picked ? 'var(--color-accent)' : 'var(--color-border)'),
        outlineColor: 'var(--color-accent)',
      }}
    >
      {/* Image */}
      <div className="aspect-square overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-display font-black text-3xl"
            style={{ color: 'var(--color-border)' }}
          >
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {product.brand && (
          <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {product.brand}
          </div>
        )}
        <div
          className="font-display font-bold text-sm leading-tight line-clamp-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {product.name}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: 'var(--color-accent)' }}>
            {priceLabel}
          </span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-black transition"
            style={{
              background: picked ? 'var(--color-accent)' : 'transparent',
              color: picked ? '#000' : 'var(--color-accent)',
              border: '1.5px solid var(--color-accent)',
            }}
            aria-hidden
          >
            {picked ? '✓' : '+'}
          </span>
        </div>
      </div>
    </button>
  )
}
