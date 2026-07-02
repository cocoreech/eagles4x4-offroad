'use client'

// ============================================================
// AdminEditBookingForm — admin edit of an existing booking
// ============================================================
// Mirrors the customer EditBookingForm but calls adminUpdateBooking, adds
// name + preferred-name fields, and drops the "reverts to pending" note
// (admins override availability and status).

import { useState, useTransition } from 'react'
import { adminUpdateBooking } from '../actions'

type Service = {
  id: string
  name: string
  starting_price: number
  category: string
  icon: string | null
}

type Initial = {
  serviceIds: string[]
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string | number
  vehicleTransmission: string
  scheduledDate: string
  scheduledTime: string
  contactName: string
  preferredName: string
  contactPhone: string
  contactEmail: string
  notes: string
}

export default function AdminEditBookingForm({
  bookingId,
  services,
  initial,
}: Readonly<{ bookingId: string; services: Service[]; initial: Initial }>) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.serviceIds))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function handleSubmit(formData: FormData) {
    if (selected.size === 0) { setError('Select at least one service.'); return }
    setError(null)
    Array.from(selected).forEach(id => formData.append('serviceIds', id))
    startTransition(async () => {
      const result = await adminUpdateBooking(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  const subtotal = services.filter(s => selected.has(s.id)).reduce((sum, s) => sum + Number(s.starting_price), 0)
  const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH')

  return (
    <form action={handleSubmit} className="space-y-8">
      <input type="hidden" name="bookingId" value={bookingId} />

      {/* Services */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">Services</h2>
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
                  <div className="text-2xl">{s.icon ?? '🔧'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.name}</div>
                    <div className="text-xs mt-2 font-bold" style={{ color: 'var(--color-accent)' }}>From {peso(Number(s.starting_price))}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Vehicle (read-only) */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">Vehicle</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ReadonlyField label="Make" value={initial.vehicleMake} />
          <ReadonlyField label="Model" value={initial.vehicleModel} />
          <ReadonlyField label="Year" value={String(initial.vehicleYear)} />
          <ReadonlyField label="Transmission" value={initial.vehicleTransmission} />
        </div>
      </section>

      {/* Schedule */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date" name="scheduledDate" type="date" defaultValue={initial.scheduledDate} required />
          <Field label="Time (HH:MM)" name="scheduledTime" type="time" defaultValue={initial.scheduledTime} required />
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Admins can place any date/time. A date/time change notifies the customer to confirm or reschedule.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4">Contact</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full name" name="contactName" defaultValue={initial.contactName} required />
          <Field label="Preferred name" name="preferredName" defaultValue={initial.preferredName} required />
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <PhoneRebuilt initial={initial.contactPhone} />
          <Field label="Email" name="contactEmail" type="email" defaultValue={initial.contactEmail} required />
          <Field label="Notes" name="notes" multiline defaultValue={initial.notes} />
        </div>
      </section>

      {/* Submit */}
      <section className="pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
          <span className="font-display font-bold text-2xl" style={{ color: 'var(--color-accent)' }}>{peso(subtotal)}</span>
        </div>
        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-destructive)' }}>{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-4 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
      </section>
    </form>
  )
}

function PhoneRebuilt({ initial }: Readonly<{ initial: string }>) {
  const isE164 = initial.startsWith('+')
  const initialDial = isE164 ? initial.slice(0, 3) : '+63'
  const initialLocal = isE164 ? initial.slice(initialDial.length) : initial
  const inputStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } as const
  return (
    <div>
      <span className="block text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>Mobile</span>
      <div className="flex gap-2">
        <input name="contactPhoneDial" defaultValue={initialDial} className="w-24 px-3 py-3 rounded-sm outline-none text-sm" style={inputStyle} />
        <input name="contactPhoneLocal" defaultValue={initialLocal} className="flex-1 px-4 py-3 rounded-sm outline-none text-sm" style={inputStyle} />
      </div>
      <input type="hidden" name="contactPhone" value={initial} />
    </div>
  )
}

function Field({ label, name, type = 'text', defaultValue, multiline, required }: Readonly<{ label: string; name: string; type?: string; defaultValue?: string; multiline?: boolean; required?: boolean }>) {
  const styles = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } as const
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      {multiline ? (
        <textarea name={name} defaultValue={defaultValue} rows={3} className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      )}
    </label>
  )
}

function ReadonlyField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <input value={value} readOnly className="w-full px-4 py-3 rounded-sm outline-none text-sm cursor-not-allowed" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }} />
    </label>
  )
}
