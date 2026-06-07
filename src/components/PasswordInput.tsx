'use client'

// ============================================================
// PasswordInput — text input with show/hide eye toggle
// Used on admin login + account/set-password.
// ============================================================

import { useState } from 'react'

type Props = {
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  minLength?: number
  required?: boolean
  autoFocus?: boolean
}

export default function PasswordInput({
  name,
  label,
  autoComplete,
  minLength = 8,
  required = true,
  autoFocus = false,
}: Props) {
  const [show, setShow] = useState(false)

  return (
    <label className="block">
      <span
        className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <div className="relative">
        <input
          name={name}
          type={show ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          autoFocus={autoFocus}
          className="w-full pl-4 pr-12 py-3 rounded-sm outline-none transition text-sm"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-xs transition opacity-60 hover:opacity-100"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {show ? (
            // Eye with slash (hide)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            // Eye open (show)
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>
      </div>
    </label>
  )
}
