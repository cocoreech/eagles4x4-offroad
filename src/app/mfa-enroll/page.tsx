// ============================================================
// /mfa-enroll — set up TOTP (Google Authenticator, 1Password, Authy)
// ============================================================
// Required for admin role. Customers don't need MFA.

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth'
import MfaEnrollForm from './MfaEnrollForm'

export const dynamic = 'force-dynamic'

export default async function MfaEnrollPage() {
  await requireAuth()
  const supabase = createClient()

  // If a TOTP factor is already verified, skip enrollment — they just need to challenge.
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const existingVerified = factors?.totp?.find(f => f.status === 'verified')
  if (existingVerified) redirect('/mfa-challenge')

  // Clean up any unverified pending factors from earlier failed attempts.
  // factors.totp only lists verified ones — use factors.all for everything.
  if (factors?.all) {
    for (const f of factors.all) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
    }
  }

  // Enroll a new TOTP factor. Supabase returns the QR code as SVG + raw secret.
  const { data: enroll, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Eagles 4x4',
  })

  if (error || !enroll) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center text-sm" style={{ color: 'var(--color-destructive)' }}>
          Could not start MFA enrollment. Please refresh and try again.
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
              Enroll Authenticator
            </span>
          </div>
          <h1
            className="font-display font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 40px)' }}
          >
            Set Up<br />
            <em style={{ color: 'var(--color-accent)' }}>Two-Factor.</em>
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
          >
            Scan the QR code below with your authenticator app, then enter the 6-digit code it shows.
          </p>
        </div>

        <div
          className="rounded-md p-7 mb-6"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          {/* QR Code from Supabase — already an SVG data URL */}
          <div className="flex justify-center mb-6">
            <div
              className="p-4 bg-white rounded-sm"
              dangerouslySetInnerHTML={{ __html: enroll.totp.qr_code }}
            />
          </div>

          <div className="text-center mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Can&apos;t scan? Type this secret manually:
          </div>
          <div
            className="font-mono text-xs text-center break-all p-3 rounded-sm mb-6"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-accent)',
            }}
          >
            {enroll.totp.secret}
          </div>

          <MfaEnrollForm factorId={enroll.id} />
        </div>

        <div className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-text-primary)' }} className="block mb-2">
            Recommended apps:
          </strong>
          1Password · Google Authenticator · Authy · Microsoft Authenticator
        </div>
      </div>
    </main>
  )
}
