// ============================================================
// /account — customer account settings
// ============================================================

import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import DeleteAccountForm from './DeleteAccountForm'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await requireAuth()
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, preferred_name, email, phone')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <main className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href="/bookings" className="text-xs font-extrabold uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
          My Bookings →
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10">
            <div className="mb-3 inline-flex items-center gap-2">
              <div className="h-px w-7" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.4em]" style={{ color: 'var(--color-accent)' }}>
                Your Account
              </span>
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 44px)' }}>
              Account <em style={{ color: 'var(--color-accent)' }}>Settings.</em>
            </h1>
          </div>

          <section className="mb-8 rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <Row label="Name" value={profile?.preferred_name || profile?.full_name} />
            <Row label="Email" value={profile?.email ?? user.email ?? null} />
            <Row label="Phone" value={profile?.phone} />
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
              <Link href="/account/set-password" className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>
                Set / change password →
              </Link>
            </div>
          </section>

          <section className="rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-destructive)' }}>
            <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-destructive)' }}>
              Danger Zone
            </h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Deleting your account is permanent. You&apos;re free to leave anytime — this removes your
              profile and personal history from our system.
            </p>
            <DeleteAccountForm />
          </section>
        </div>
      </div>
    </main>
  )
}

function Row({ label, value }: Readonly<{ label: string; value: string | null | undefined }>) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}
