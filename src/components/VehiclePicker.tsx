'use client'

// ============================================================
// VehiclePicker — cascading Make → Model → Year dropdowns
// ============================================================
// Free-text input is removed entirely so attackers can't inject
// arbitrary strings (the only values posted are ones from our list).
// Server-side validation also re-checks against the allowed list.

import { useState } from 'react'
import { VEHICLE_MAKES_MODELS, ALLOWED_MAKES, vehicleYearRange } from '@/lib/vehicles'

export default function VehiclePicker({
  defaultMake,
  defaultModel,
  defaultYear,
  defaultTransmission,
}: Readonly<{
  defaultMake?: string
  defaultModel?: string
  defaultYear?: string
  defaultTransmission?: string
}> = {}) {
  const [make, setMake] = useState(defaultMake ?? '')
  const [model, setModel] = useState(defaultModel ?? '')
  const [year, setYear] = useState(defaultYear ?? '')
  const [transmission, setTransmission] = useState(defaultTransmission ?? '')

  const availableModels = make ? (VEHICLE_MAKES_MODELS[make] ?? []) : []
  const years = vehicleYearRange()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Hidden inputs that submit with the parent form */}
      <input type="hidden" name="vehicleMake" value={make} />
      <input type="hidden" name="vehicleModel" value={model} />
      <input type="hidden" name="vehicleYear" value={year} />
      <input type="hidden" name="vehicleTransmission" value={transmission} />

      <Select
        label="Make"
        value={make}
        onChange={(v) => {
          setMake(v)
          setModel('')  // reset model when make changes
        }}
        options={ALLOWED_MAKES}
        placeholder="— Select brand —"
      />

      <Select
        label="Model"
        value={model}
        onChange={setModel}
        options={availableModels}
        placeholder={make ? '— Select model —' : 'Pick make first'}
        disabled={!make}
      />

      <Select
        label="Year"
        value={year}
        onChange={setYear}
        options={years.map(String)}
        placeholder="— Year —"
      />

      <Select
        label="Transmission"
        value={transmission}
        onChange={setTransmission}
        options={['automatic', 'manual']}
        placeholder="— Select —"
        format={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
      />
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  format,
}: Readonly<{
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  disabled?: boolean
  format?: (v: string) => string
}>) {
  return (
    <label className="block">
      <span
        className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        className="w-full px-4 py-3 rounded-sm outline-none text-sm transition disabled:opacity-50"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          colorScheme: 'dark',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{format ? format(o) : o}</option>
        ))}
      </select>
    </label>
  )
}
