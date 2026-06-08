// ============================================================
// PublicNav — top nav for public-facing pages
// ============================================================
// Server Component — reads session to decide Sign In vs avatar.

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import BrandMark from './BrandMark'

export default async function PublicNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 h-16 flex items-center justify-between"
      style={{
        background: 'linear-gradient(to bottom, rgba(8,8,8,0.92) 0%, rgba(8,8,8,0.0) 100%)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <BrandMark href="/" />

      {/* Nav links — hidden on mobile, shown on md+ */}
      <ul className="hidden md:flex gap-8 list-none">
        <NavLink href="/builds" label="Builds" />
        <NavLink href="/services" label="Services" />
        <NavLink href="/events" label="Events" />
        <NavLink href="/#about" label="About" />
      </ul>

      {/* Right action — Book Now or signed-in state */}
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
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: 'var(--color-accent)' }}
              >
                Admin
              </Link>
            )}
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
              href="/login?next=/bookings/new"
              className="px-5 py-2.5 text-[11px] font-extrabold tracking-[0.12em] uppercase rounded-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              Book Now
            </Link>
          </>
        )}
      </div>
    </nav>
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
