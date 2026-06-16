'use client'

// ============================================================
// EventForm — shared by New + Edit pages
// ============================================================

import { useState, useTransition } from 'react'
import Link from 'next/link'
import ImageUpload from '@/components/ImageUpload'
import { createEvent, updateEvent } from './actions'

type Event = {
  id?: string
  slug?: string
  title?: string
  description?: string | null
  event_type?: string | null
  starts_at?: string
  ends_at?: string | null
  location?: string | null
  difficulty?: string | null
  cover_image_url?: string | null
  is_published?: boolean
}

const EVENT_TYPES = [
  { value: 'trail_ride',     label: 'Trail Ride' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'promo',          label: 'Promo' },
  { value: 'meetup',         label: 'Meetup' },
  { value: 'workshop',       label: 'Workshop' },
]

const DIFFICULTIES = [
  { value: 'easy',     label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'hard',     label: 'Hard' },
  { value: 'extreme',  label: 'Extreme' },
  { value: 'n/a',      label: 'N/A (not a trail ride)' },
]

// datetime-local input expects "YYYY-MM-DDTHH:mm"
function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export default function EventForm({ initial }: Readonly<{ initial?: Event }>) {
  const isEdit = !!initial?.id
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    if (isEdit && initial?.id) formData.set('id', initial.id)
    startTransition(async () => {
      const action = isEdit ? updateEvent : createEvent
      const result = await action(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Cover image */}
      <ImageUpload
        folder="events"
        hiddenInputName="cover_image_url"
        initialUrl={initial?.cover_image_url ?? null}
        label="Cover image"
      />

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          name="title" label="Title" required
          defaultValue={initial?.title ?? ''}
          placeholder="Cavite Trail Ride 2025"
        />
        <Field
          name="slug" label="Slug (URL-safe)" required
          defaultValue={initial?.slug ?? ''}
          placeholder="cavite-trail-ride-2025"
          help="Lowercase letters, numbers, dashes only"
        />
      </div>

      {/* Classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select name="event_type" label="Event Type" defaultValue={initial?.event_type ?? ''}>
          <option value="">— Pick type —</option>
          {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Select name="difficulty" label="Trail Difficulty" defaultValue={initial?.difficulty ?? ''}>
          <option value="">— Pick difficulty —</option>
          {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </Select>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          name="starts_at" label="Starts at" type="datetime-local" required
          defaultValue={toDatetimeLocal(initial?.starts_at)}
        />
        <Field
          name="ends_at" label="Ends at (optional)" type="datetime-local"
          defaultValue={toDatetimeLocal(initial?.ends_at)}
        />
      </div>

      {/* Location */}
      <Field
        name="location" label="Location"
        defaultValue={initial?.location ?? ''}
        placeholder="Dasmariñas to Alfonso, Cavite"
      />

      {/* Description */}
      <Field
        name="description" label="Description" multiline
        defaultValue={initial?.description ?? ''}
        placeholder="Details about this event…"
      />

      {/* Publish toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="is_published"
          defaultChecked={initial?.is_published ?? false}
          className="w-5 h-5"
          style={{ accentColor: 'var(--color-accent)' }}
        />
        <span className="text-sm">
          <strong>Published</strong>
          <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Visible on the public Events page
          </span>
        </span>
      </label>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
        </button>
        <Link
          href="/admin/events"
          className="px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

// ─── Local helpers ─────────────────────────────────────────────
function Field({
  name, label, type = 'text', defaultValue, placeholder, required, multiline, help,
}: Readonly<{
  name: string; label: string; type?: string; defaultValue?: string; placeholder?: string;
  required?: boolean; multiline?: boolean; help?: string
}>) {
  const styles = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
  } as const
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={4}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm"
          style={styles}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm"
          style={styles}
        />
      )}
      {help && <span className="block text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{help}</span>}
    </label>
  )
}

function Select({
  name, label, children, defaultValue,
}: Readonly<{
  name: string; label: string; children: React.ReactNode; defaultValue?: string
}>) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="w-full px-4 py-3 rounded-sm outline-none text-sm"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          colorScheme: 'dark',
        }}
      >
        {children}
      </select>
    </label>
  )
}
