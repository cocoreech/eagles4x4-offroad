'use client'

// PublicNav — top nav for public-facing pages.
// Client component so dropdowns can toggle on click/hover without JS bundles.

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import BrandMark from './BrandMark'

// ── Dropdown data ─────────────────────────────────────────────────────────────

const ABOUT_LINKS = [
  { href: '/about',             label: 'Corporate Profile' },
  { href: '/about/community',   label: 'Giving Back'       },
  { href: '/#about',            label: 'Brotherhood'       },
]

const SP_LINKS = [
  { href: '/services#services', label: 'Services'  },
  { href: '/services#products', label: 'Products'  },
  { href: '/services#quote',    label: 'Get a Quote' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLLIElement>(null) as React.MutableRefObject<HTMLLIElement>
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return { open, setOpen, ref }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Dropdown({
  label,
  links,
  open,
  setOpen,
  dropRef,
}: Readonly<{
  label: string
  links: ReadonlyArray<{ href: string; label: string }>
  open: boolean
  setOpen: (v: boolean) => void
  dropRef: React.RefObject<HTMLLIElement>
}>) {
  return (
    <li ref={dropRef as React.RefObject<HTMLLIElement>} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.1em] uppercase transition focus-visible:outline focus-visible:outline-2"
        style={{ color: 'var(--color-text-muted)', outlineColor: 'var(--color-accent)' }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className="transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          className="absolute top-full left-0 mt-3 min-w-[180px] py-2 list-none rounded-sm"
          style={{
            background: 'rgba(14,14,14,0.97)',
            border: '1px solid rgba(201,168,76,0.18)',
            backdropFilter: 'blur(12px)',
            zIndex: 60,
          }}
        >
          {links.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="block px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
                style={{ color: 'rgba(245,245,245,0.6)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,245,245,0.6)')}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function NavLink({ href, label }: Readonly<{ href: string; label: string }>) {
  return (
    <li>
      <Link
        href={href}
        className="text-[11px] font-semibold tracking-[0.1em] uppercase transition"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </Link>
    </li>
  )
}

// ── Main nav ─────────────────────────────────────────────────────────────────

export default function PublicNav({ user, isAdmin }: Readonly<{ user?: { id: string } | null; isAdmin?: boolean }>) {
  const sp = useDropdown()
  const about = useDropdown()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 h-16 flex items-center justify-between"
        style={{
          background: 'linear-gradient(to bottom, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.0) 100%)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <BrandMark href="/" />

        {/* Desktop nav */}
        <ul className="hidden md:flex gap-8 list-none items-center">
          <NavLink href="/builds" label="Builds" />

          <Dropdown
            label="Services & Products"
            links={SP_LINKS}
            open={sp.open}
            setOpen={sp.setOpen}
            dropRef={sp.ref}
          />

          <NavLink href="/events" label="Events & Promos" />

          <NavLink href="/find-a-store" label="Find a Store" />

          <Dropdown
            label="About"
            links={ABOUT_LINKS}
            open={about.open}
            setOpen={about.setOpen}
            dropRef={about.ref}
          />
        </ul>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/bookings"
                className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                My Bookings
              </Link>
              <Link
                href="/inbox"
                className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Inbox
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Admin
                </Link>
              )}
              <form action="/logout" method="post" className="hidden sm:inline-block">
                <button type="submit" className="text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
                  Sign Out
                </button>
              </form>
              <Link
                href="/bookings/new"
                className="px-5 py-2.5 text-[11px] font-extrabold tracking-[0.12em] uppercase rounded-sm"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                Book Now
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Sign In
              </Link>
              <Link
                href="/bookings/new"
                className="px-5 py-2.5 text-[11px] font-extrabold tracking-[0.12em] uppercase rounded-sm"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                Book Now
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 focus-visible:outline focus-visible:outline-2 rounded-sm"
            style={{ outlineColor: 'var(--color-accent)' }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span className="block w-5 h-px transition-all" style={{ background: 'var(--color-text-muted)', transform: mobileOpen ? 'rotate(45deg) translate(3px, 3px)' : undefined }} />
            <span className="block w-5 h-px transition-all" style={{ background: 'var(--color-text-muted)', opacity: mobileOpen ? 0 : 1 }} />
            <span className="block w-5 h-px transition-all" style={{ background: 'var(--color-text-muted)', transform: mobileOpen ? 'rotate(-45deg) translate(3px, -3px)' : undefined }} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col pt-16"
          style={{ background: 'rgba(8,8,8,0.97)', backdropFilter: 'blur(12px)' }}
        >
          <ul className="flex flex-col px-6 py-8 gap-1 list-none overflow-y-auto">
            <MobileLink href="/builds" label="Builds" onClick={() => setMobileOpen(false)} />

            <li className="pt-4 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'rgba(201,168,76,0.5)' }}>
                Services & Products
              </span>
            </li>
            {SP_LINKS.map(l => (
              <MobileLink key={l.href} href={l.href} label={l.label} onClick={() => setMobileOpen(false)} indent />
            ))}

            <MobileLink href="/events" label="Events & Promos" onClick={() => setMobileOpen(false)} />
            <MobileLink href="/find-a-store" label="Find a Store" onClick={() => setMobileOpen(false)} />

            <li className="pt-4 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'rgba(201,168,76,0.5)' }}>
                About
              </span>
            </li>
            {ABOUT_LINKS.map(l => (
              <MobileLink key={l.href} href={l.href} label={l.label} onClick={() => setMobileOpen(false)} indent />
            ))}

            <li className="pt-8 flex flex-col gap-3">
              {user ? (
                <>
                  <Link href="/bookings" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] rounded-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    My Bookings
                  </Link>
                  <Link href="/inbox" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] rounded-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    Inbox
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] rounded-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
                      Admin
                    </Link>
                  )}
                  <Link href="/bookings/new" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] rounded-sm" style={{ background: 'var(--color-accent)', color: '#000' }}>
                    Book Now
                  </Link>
                  <form action="/logout" method="post">
                    <button type="submit" className="block w-full px-6 py-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] rounded-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                      Sign Out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] rounded-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    Sign In
                  </Link>
                  <Link href="/bookings/new" onClick={() => setMobileOpen(false)} className="block px-6 py-4 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] rounded-sm" style={{ background: 'var(--color-accent)', color: '#000' }}>
                    Book Now
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </>
  )
}

function MobileLink({
  href, label, onClick, indent, badge,
}: Readonly<{ href: string; label: string; onClick: () => void; indent?: boolean; badge?: string }>) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className="flex items-center gap-2 py-3 text-[13px] font-semibold uppercase tracking-[0.1em] transition-colors"
        style={{ color: 'rgba(245,245,245,0.7)', paddingLeft: indent ? '12px' : undefined }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,245,245,0.7)')}
      >
        {indent && <span style={{ color: 'rgba(201,168,76,0.4)' }}>—</span>}
        {label}
        {badge && (
          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--color-accent)', letterSpacing: '0.1em' }}>
            {badge}
          </span>
        )}
      </Link>
    </li>
  )
}
