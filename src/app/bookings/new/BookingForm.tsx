'use client'

// ============================================================
// BookingForm — minimal client form, calls createBooking server action
// Polished UI follows in Step 4 (Frontend) using the Phase 3 design.
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { createBooking } from './actions'
import DateTimePicker from '@/components/DateTimePicker'
import VehiclePicker from '@/components/VehiclePicker'
import PhoneInput from '@/components/PhoneInput'
import { BRANCHES, type BranchSlug } from '@/content/branches'

type Service = {
  id: string
  slug: string
  name: string
  description: string | null
  starting_price: number
  category: string
  icon: string | null
}

type Product = {
  id: string
  slug: string
  name: string
  brand: string | null
  price: number | null
}

const QUOTE_KEY = 'eagles4x4.quote'

export default function BookingForm({
  services,
  products,
  defaultEmail,
  defaultName,
  defaultPreferredName,
  hasPreferredName,
}: Readonly<{
  services: Service[]
  products: Product[]
  defaultEmail: string
  defaultName: string
  defaultPreferredName: string
  hasPreferredName: boolean
}>) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [prefilledNotes, setPrefilledNotes] = useState<string>('')
  const [branch, setBranch] = useState<BranchSlug>('cavite')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Split any prefilled full name into first/last for the two-field name inputs.
  const nameParts = defaultName.trim().split(/\s+/).filter(Boolean)
  const defaultFirst = nameParts[0] ?? ''
  const defaultLast = nameParts.slice(1).join(' ')

  // Hydrate from the /services Quote Calculator if the customer came from there.
  // We map slugs → IDs server-data-side, so a stale cart with deleted items
  // simply ignores them rather than breaking the form.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUOTE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { services?: string[]; products?: string[] }

      if (Array.isArray(parsed.services) && parsed.services.length > 0) {
        const slugToId = new Map(services.map(s => [s.slug, s.id]))
        const ids = parsed.services
          .map(slug => slugToId.get(slug))
          .filter((id): id is string => !!id)
        if (ids.length > 0) setSelected(new Set(ids))
      }

      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        const slugToName = new Map(products.map(p => [p.slug, p.brand ? `${p.brand} ${p.name}` : p.name]))
        const names = parsed.products
          .map(slug => slugToName.get(slug))
          .filter((n): n is string => !!n)
        if (names.length > 0) {
          setPrefilledNotes(`Requested products from quote:\n• ${names.join('\n• ')}`)
        }
      }
    } catch {
      // Ignore corrupt cart — form is still usable.
    }
    // We intentionally read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function handleSubmit(formData: FormData) {
    if (selected.size === 0) {
      setError('Select at least one service.')
      return
    }
    setError(null)
    // The name is captured as two fields; the server stores one full name.
    const first = String(formData.get('firstName') ?? '').trim()
    const last = String(formData.get('lastName') ?? '').trim()
    formData.set('contactName', `${first} ${last}`.trim())
    // Server action expects serviceIds as multi-value; FormData append once per id
    Array.from(selected).forEach(id => formData.append('serviceIds', id))
    startTransition(async () => {
      const result = await createBooking(formData)
      if (result && 'error' in result && result.error) {
        setError(result.error)
      } else {
        // Submitted (will redirect) — clear the cart so a back-nav starts fresh.
        try { sessionStorage.removeItem(QUOTE_KEY) } catch { /* non-fatal */ }
      }
    })
  }

  const subtotal = services
    .filter(s => selected.has(s.id))
    .reduce((sum, s) => sum + Number(s.starting_price), 0)

  const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH')

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* ── Branch ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Choose a <em style={{ color: 'var(--color-accent)' }}>Branch</em>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BRANCHES.map(b => {
            const isSel = branch === b.slug
            const disabled = !b.bookable
            return (
              <button
                key={b.slug}
                type="button"
                disabled={disabled}
                onClick={() => setBranch(b.slug)}
                className="text-left p-4 rounded-md transition border-2 disabled:cursor-not-allowed"
                style={{
                  background: isSel ? 'rgba(201,168,76,0.06)' : 'var(--color-surface)',
                  borderColor: isSel ? 'var(--color-accent)' : 'var(--color-border)',
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{b.name}</span>
                  {disabled ? (
                    <span
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      Coming Soon
                    </span>
                  ) : (
                    isSel && <span className="text-sm flex-shrink-0" style={{ color: 'var(--color-accent)' }}>✓</span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{b.region}</div>
              </button>
            )
          })}
        </div>
        <input type="hidden" name="branch" value={branch} />
      </section>

      {/* ── Service selection ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Choose <em style={{ color: 'var(--color-accent)' }}>Services</em>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map(s => {
            const isSel = selected.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className="text-left p-4 rounded-md transition border-2"
                style={{
                  background: isSel ? 'rgba(201,168,76,0.06)' : 'var(--color-surface)',
                  borderColor: isSel ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">{s.icon ?? '🔧'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                      {s.description}
                    </div>
                    <div className="text-xs mt-2 font-bold" style={{ color: 'var(--color-accent)' }}>
                      From {peso(Number(s.starting_price))}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Vehicle ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Your <em style={{ color: 'var(--color-accent)' }}>Vehicle</em>
        </h2>
        <VehiclePicker />
      </section>

      {/* ── Schedule ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Pick a <em style={{ color: 'var(--color-accent)' }}>Slot</em>
        </h2>
        <DateTimePicker />
      </section>

      {/* ── Contact ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Contact <em style={{ color: 'var(--color-accent)' }}>Info</em>
        </h2>
        <div className="grid grid-cols-1 gap-4">
          {hasPreferredName ? (
            <input type="hidden" name="preferredName" value={defaultPreferredName} />
          ) : (
            <Field
              label="What should we call you?"
              name="preferredName"
              type="text"
              placeholder="e.g. Juan, JD — the name we'll greet you by"
              defaultValue={defaultPreferredName}
              required
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="First Name"
              name="firstName"
              type="text"
              placeholder="Juan"
              defaultValue={defaultFirst}
              required
            />
            <Field
              label="Last Name"
              name="lastName"
              type="text"
              placeholder="dela Cruz"
              defaultValue={defaultLast}
              required
            />
          </div>
          <PhoneInput />
          <Field
            label="Email"
            name="contactEmail"
            type="email"
            defaultValue={defaultEmail}
            required
          />
        </div>
        <div className="mt-4">
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Notes (optional)
            </span>
            <textarea
              name="notes"
              rows={prefilledNotes ? 5 : 3}
              placeholder="Anything we should know?"
              value={prefilledNotes}
              onChange={(e) => setPrefilledNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </label>
        </div>
      </section>

      {/* ── Summary + submit ── */}
      <section className="pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
            Estimated subtotal
          </span>
          <span className="font-display font-bold text-2xl" style={{ color: 'var(--color-accent)' }}>
            {peso(subtotal)}
          </span>
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-4 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Submitting…' : 'Confirm Booking →'}
        </button>

        <p className="mt-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          We&apos;ll confirm your booking via SMS within an hour. Pay at the shop on the day.
        </p>
      </section>
    </form>
  )
}

// ─── Helpers ────────────────────────────────────────────

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  defaultValue,
  multiline,
  inputMode,
  pattern,
  title,
}: Readonly<{
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  multiline?: boolean
  inputMode?: 'text' | 'tel' | 'numeric' | 'email'
  pattern?: string
  title?: string
}>) {
  const sharedStyle = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  } as const
  return (
    <label className="block">
      <span
        className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      {multiline ? (
        <textarea
          name={name}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          rows={3}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
          style={sharedStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      ) : (
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          defaultValue={defaultValue}
          inputMode={inputMode}
          pattern={pattern}
          title={title}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
          style={sharedStyle}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      )}
    </label>
  )
}

