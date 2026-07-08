'use client'

// ============================================================
// AdminBookingForm — manual booking entry for phone-in / walk-in customers
// ============================================================
// Search by name/mobile/email first. A match auto-fills contact + vehicle
// details (still editable); no match falls through to a blank form for a
// new/walk-in customer — same shape either way, just pre-filled or not.

import { useState, useTransition } from 'react'
import { searchCustomers, adminCreateBooking, type CustomerMatch } from './actions'
import { splitE164 } from '@/lib/phone'
import DateTimePicker from '@/components/DateTimePicker'
import VehiclePicker from '@/components/VehiclePicker'
import PhoneInput from '@/components/PhoneInput'

type Service = {
  id: string
  name: string
  description: string | null
  starting_price: number
  category: string
  icon: string | null
}

export default function AdminBookingForm({ services }: Readonly<{ services: Service[] }>) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerMatch[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMatch | null>(null)
  // Bumped whenever the picked customer changes, to remount PhoneInput /
  // VehiclePicker (uncontrolled internally) with fresh defaultValue props.
  const [formKey, setFormKey] = useState(0)

  const [contactName, setContactName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function runSearch() {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearchError('Type at least 2 characters.')
      return
    }
    setSearchError(null)
    const fd = new FormData()
    fd.set('q', q)
    startSearch(async () => {
      const res = await searchCustomers(fd)
      if (res.error) setSearchError(res.error)
      setResults(res.results)
    })
  }

  function pickCustomer(c: CustomerMatch) {
    setSelectedCustomer(c)
    setContactName(c.fullName)
    setPreferredName(c.preferredName)
    setContactEmail(c.email)
    setFormKey(k => k + 1)
  }

  function startWalkIn() {
    setSelectedCustomer(null)
    setContactName('')
    setPreferredName('')
    setContactEmail('')
    setFormKey(k => k + 1)
  }

  function toggleService(id: string) {
    setSelectedServices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleSubmit(formData: FormData) {
    if (selectedServices.size === 0) {
      setError('Select at least one service.')
      return
    }
    setError(null)
    Array.from(selectedServices).forEach(id => formData.append('serviceIds', id))
    if (selectedCustomer) formData.set('customerId', selectedCustomer.id)
    startTransition(async () => {
      const result = await adminCreateBooking(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  const subtotal = services
    .filter(s => selectedServices.has(s.id))
    .reduce((sum, s) => sum + Number(s.starting_price), 0)
  const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH')

  const phoneParts = selectedCustomer?.phone ? splitE164(selectedCustomer.phone) : null

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* ── Find or add customer ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Find or Add <em style={{ color: 'var(--color-accent)' }}>Customer</em>
        </h2>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
            placeholder="Search by name, mobile, or email"
            className="flex-1 px-4 py-3 rounded-sm outline-none text-sm transition"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching}
            className="px-5 py-3 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {searchError && <p className="mt-2 text-xs" style={{ color: 'var(--color-destructive)' }}>{searchError}</p>}

        {results !== null && (
          <div className="mt-4 rounded-md p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {results.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  No matching customer found for &ldquo;{query.trim()}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={startWalkIn}
                  className="px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-sm"
                  style={{ background: 'var(--color-accent)', color: '#000' }}
                >
                  + Add as New Customer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map(r => {
                  const isPicked = selectedCustomer?.id === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => pickCustomer(r)}
                      className="w-full text-left rounded-sm p-3 transition flex items-center justify-between gap-3"
                      style={{
                        background: isPicked ? 'rgba(201,168,76,0.08)' : 'var(--color-bg)',
                        border: '1px solid ' + (isPicked ? 'var(--color-accent)' : 'var(--color-border)'),
                      }}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{r.fullName || r.preferredName || '—'}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {r.phone} {r.phone && r.email ? '·' : ''} {r.email}
                        </div>
                      </div>
                      {isPicked && <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--color-accent)' }}>✓ Selected</span>}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={startWalkIn}
                  className="w-full text-center py-2 text-xs font-bold tracking-widest uppercase"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Not them? + Add as new customer instead
                </button>
              </div>
            )}
          </div>
        )}

        {selectedCustomer && (
          <p className="mt-3 text-xs" style={{ color: 'var(--color-accent)' }}>
            ✓ Details below pre-filled from {selectedCustomer.fullName || 'this customer'}&rsquo;s record — still editable.{' '}
            <button type="button" onClick={startWalkIn} className="underline" style={{ color: 'var(--color-text-muted)' }}>
              Clear
            </button>
          </p>
        )}
      </section>

      {/* ── Services ── */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">
          Choose <em style={{ color: 'var(--color-accent)' }}>Services</em>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map(s => {
            const isSel = selectedServices.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
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
                    <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{s.description}</div>
                    <div className="text-xs mt-2 font-bold" style={{ color: 'var(--color-accent)' }}>From {peso(Number(s.starting_price))}</div>
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
          <em style={{ color: 'var(--color-accent)' }}>Vehicle</em>
        </h2>
        <VehiclePicker
          key={`veh-${formKey}`}
          defaultMake={selectedCustomer?.vehicle?.make}
          defaultModel={selectedCustomer?.vehicle?.model}
          defaultYear={selectedCustomer?.vehicle?.year ? String(selectedCustomer.vehicle.year) : undefined}
          defaultTransmission={selectedCustomer?.vehicle?.transmission ?? undefined}
        />
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
          <ControlledField
            label="What should we call them?"
            name="preferredName"
            value={preferredName}
            onChange={setPreferredName}
            placeholder="e.g. Juan, JD"
          />
          <ControlledField
            label="Full Name"
            name="contactName"
            value={contactName}
            onChange={setContactName}
            placeholder="Juan dela Cruz"
            required
          />
          <PhoneInput
            key={`phone-${formKey}`}
            defaultDial={phoneParts?.dial}
            defaultNumber={phoneParts?.local}
          />
          <ControlledField
            label="Email"
            name="contactEmail"
            type="email"
            value={contactEmail}
            onChange={setContactEmail}
            required
          />
        </div>
        <div className="mt-4">
          <label className="block">
            <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Notes (optional)
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Anything staff should know?"
              className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </label>
        </div>
      </section>

      {/* ── Summary + submit ── */}
      <section className="pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Estimated subtotal</span>
          <span className="font-display font-bold text-2xl" style={{ color: 'var(--color-accent)' }}>{peso(subtotal)}</span>
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-4 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Creating…' : 'Create Booking →'}
        </button>

        <p className="mt-3 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          Booking is created as Confirmed immediately — no separate approval step.
        </p>
      </section>
    </form>
  )
}

function ControlledField({
  label, name, value, onChange, type = 'text', placeholder, required,
}: Readonly<{
  label: string; name: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}>) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      />
    </label>
  )
}
