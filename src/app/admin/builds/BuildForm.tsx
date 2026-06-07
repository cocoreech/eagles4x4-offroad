'use client'

// ============================================================
// BuildForm — shared by New + Edit pages
// ============================================================

import { useState, useTransition } from 'react'
import Link from 'next/link'
import ImageUpload from '@/components/ImageUpload'
import MultiImageGallery from '@/components/MultiImageGallery'
import { createBuild, updateBuild, deleteBuild } from './actions'

type Build = {
  id?: string
  slug?: string
  title?: string
  vehicle_make?: string
  vehicle_model?: string
  vehicle_year?: number | null
  location?: string | null
  description?: string | null
  build_date?: string | null
  duration_days?: number | null
  is_featured?: boolean
  cover_image_url?: string | null
  gallery_image_urls?: string[] | null
  tags?: string[] | null
}

export default function BuildForm({ initial }: { initial?: Build }) {
  const isEdit = !!initial?.id
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    if (isEdit && initial?.id) formData.set('id', initial.id)
    startTransition(async () => {
      const action = isEdit ? updateBuild : createBuild
      const result = await action(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  function handleDelete() {
    if (!initial?.id) return
    if (!confirm(`Delete "${initial.title}"? This cannot be undone.`)) return
    const fd = new FormData()
    fd.set('id', initial.id)
    startDelete(async () => {
      const result = await deleteBuild(fd)
      if (result && 'error' in result && result.error) setError(result.error)
      else window.location.href = '/admin/builds?deleted=1'
    })
  }

  return (
    <form action={handleSubmit} className="space-y-7">
      {/* Cover image */}
      <ImageUpload
        folder="builds"
        hiddenInputName="coverImageUrl"
        initialUrl={initial?.cover_image_url ?? null}
        label="Cover image (hero photo)"
        recommendedSize="1920×1080"
        recommendedKB={800}
      />

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="title" label="Build Title" required
          defaultValue={initial?.title ?? ''}
          placeholder='4" Lift + ARB Bull Bar Setup'
        />
        <Field name="slug" label="Slug (URL-safe)" required
          defaultValue={initial?.slug ?? ''}
          placeholder="hilux-4inch-lift-arb"
          help="Lowercase letters, numbers, dashes"
        />
      </div>

      {/* Vehicle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field name="vehicleMake" label="Make" required
          defaultValue={initial?.vehicle_make ?? ''}
          placeholder="Toyota"
        />
        <Field name="vehicleModel" label="Model" required
          defaultValue={initial?.vehicle_model ?? ''}
          placeholder="Hilux"
        />
        <Field name="vehicleYear" label="Year" type="number"
          defaultValue={initial?.vehicle_year ? String(initial.vehicle_year) : ''}
          placeholder="2024"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field name="location" label="Location"
          defaultValue={initial?.location ?? ''}
          placeholder="Cavite"
        />
        <Field name="buildDate" label="Build date" type="date"
          defaultValue={initial?.build_date ?? ''}
        />
        <Field name="durationDays" label="Days to complete" type="number"
          defaultValue={initial?.duration_days ? String(initial.duration_days) : ''}
          placeholder="14"
        />
      </div>

      {/* Description */}
      <Field name="description" label="Description / Story" multiline
        defaultValue={initial?.description ?? ''}
        placeholder="Started with a stock Hilux, ended with a full overlander…"
      />

      {/* Tags */}
      <Field name="tags" label="Tags (comma-separated)"
        defaultValue={initial?.tags?.join(', ') ?? ''}
        placeholder="Lift Kit, Suspension, Bull Bar, Winch"
        help="Up to 12 tags · letters/numbers/spaces"
      />

      {/* Featured toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="isFeatured"
          defaultChecked={initial?.is_featured ?? false}
          className="w-5 h-5"
          style={{ accentColor: 'var(--color-accent)' }}
        />
        <span className="text-sm">
          <strong>★ Feature on homepage</strong>
          <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Featured builds appear first in the gallery
          </span>
        </span>
      </label>

      {/* Multi-image gallery */}
      <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <MultiImageGallery
          folder="builds"
          hiddenInputName="galleryUrls"
          initialUrls={initial?.gallery_image_urls ?? []}
          maxImages={30}
          label="Photo gallery (before/after, details, the journey)"
        />
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="submit"
          disabled={pending || deleting}
          className="px-6 py-3 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Build'}
        </button>
        <Link
          href="/admin/builds"
          className="px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm border"
          style={{ borderColor: 'var(--color-border-2)', color: 'var(--color-text-primary)' }}
        >
          Cancel
        </Link>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || pending}
            className="ml-auto px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm border disabled:opacity-50"
            style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}
          >
            {deleting ? 'Deleting…' : 'Delete Build'}
          </button>
        )}
      </div>
    </form>
  )
}

function Field({
  name, label, type = 'text', defaultValue, placeholder, required, multiline, help,
}: {
  name: string; label: string; type?: string; defaultValue?: string; placeholder?: string;
  required?: boolean; multiline?: boolean; help?: string
}) {
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
        <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={5}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      )}
      {help && <span className="block text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{help}</span>}
    </label>
  )
}
