// ============================================================
// /verify-email — landing page for unconfirmed email accounts
// ============================================================
// The middleware redirects here when:
//   - user.email_confirmed_at is null
//   - user has an active session

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export default async function VerifyEmailPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
          <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
            Verification Needed
          </span>
        </div>

        <h1
          className="font-display font-black leading-none mb-4"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)' }}
        >
          Check your<br />
          <em style={{ color: 'var(--color-accent)' }}>inbox.</em>
        </h1>

        <p
          className="text-sm mb-6"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
        >
          We sent a verification link to{' '}
          <span style={{ color: 'var(--color-text-primary)', fontStyle: 'normal' }}>
            {user?.email ?? 'your email'}
          </span>.
          <br />Click it to finish signing in.
        </p>

        <div
          className="rounded-md p-5 mb-6 text-left text-xs"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <strong style={{ color: 'var(--color-text-primary)' }} className="block mb-2">
            Didn&apos;t get it?
          </strong>
          1. Check your spam folder.<br />
          2. Make sure you typed the right email.<br />
          3. Go back and request a new code.
        </div>

        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm transition border"
            style={{ borderColor: 'var(--color-border-2)', color: 'var(--color-text-primary)' }}
          >
            ← Try Again
          </Link>
          <Link
            href="/logout"
            className="px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm transition"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Sign Out
          </Link>
        </div>
      </div>
    </main>
  )
}
