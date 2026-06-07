'use client'

// ============================================================
// LoginForm — two-step UI: enter email → enter 6-digit code
// Includes a "Resend code" link with 30-second cooldown.
// ============================================================

import { useState, useTransition, useEffect } from 'react'
import { sendOtp, verifyOtp } from './actions'

type Stage = 'email' | 'code'

const RESEND_COOLDOWN_SECONDS = 30

export default function LoginForm() {
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [cooldown, setCooldown] = useState(0)

  // Countdown ticker for the resend button cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleSend(formData: FormData) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await sendOtp(formData)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('success' in result && result.success) {
        setEmail(result.email)
        setStage('code')
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    })
  }

  function handleResend() {
    if (cooldown > 0 || pending) return
    setError(null)
    setNotice(null)
    const fd = new FormData()
    fd.append('email', email)
    startTransition(async () => {
      const result = await sendOtp(fd)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      setNotice('New code sent — check your email.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }

  function handleVerify(formData: FormData) {
    setError(null)
    setNotice(null)
    // The server action redirects on success — we only handle errors here.
    startTransition(async () => {
      const result = await verifyOtp(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <div
      className="rounded-md p-7"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {stage === 'email' ? (
        <form action={handleSend} className="space-y-5">
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Email Address
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="juan@example.com"
              className="w-full px-4 py-3 rounded-sm outline-none transition text-sm"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </label>

          {error && (
            <p
              className="text-xs"
              style={{ color: 'var(--color-destructive)' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {pending ? 'Sending…' : 'Send Sign-In Code →'}
          </button>
        </form>
      ) : (
        <form action={handleVerify} className="space-y-5">
          <div
            className="text-center pb-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-accent)' }}
            >
              ✉ Email Sent
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {email}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Click the link in your email, or enter the 6-digit code below.
            </p>
          </div>

          <input type="hidden" name="email" value={email} />
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              6-Digit Code
            </span>
            <input
              name="token"
              type="text"
              inputMode="numeric"
              pattern="\d{4,8}"
              maxLength={8}
              required
              autoComplete="one-time-code"
              placeholder="0000000"
              className="w-full px-4 py-3 rounded-sm outline-none transition text-center text-2xl font-mono tracking-[0.5em]"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                letterSpacing: '0.5em',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </label>

          {error && (
            <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}
          {notice && (
            <p className="text-xs" style={{ color: 'var(--color-success, #22c55e)' }}>
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {pending ? 'Verifying…' : 'Verify & Sign In'}
          </button>

          {/* Resend code button — disabled during 30s cooldown */}
          <div
            className="flex items-center justify-between pt-2 border-t text-xs"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setError(null)
                setNotice(null)
              }}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ← Different email
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || pending}
              className="text-xs font-semibold disabled:opacity-50"
              style={{
                color: cooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-accent)',
              }}
            >
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : pending
                ? 'Sending…'
                : 'Resend code →'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
