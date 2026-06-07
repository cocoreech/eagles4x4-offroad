'use client'

// ============================================================
// ProductForm — shared by New + Edit pages
// ============================================================

import { useState, useTransition } from 'react'
import Link from 'next/link'
import ImageUpload from '@/components/ImageUpload'
import { createProduct, updateProduct } from './actions'

type Product = {
  id?: string
  slug?: string
  name?: string
  brand?: string | null
  description?: string | null
  category?: string
  price?: number
  stock?: number
  image_url?: string | null
  is_active?: boolean
}

const CATEGORIES = [
  { value: 'suspension',   label: 'Suspension' },
  { value: 'wheels-tires', label: 'Wheels & Tires' },
  { value: 'recovery',     label: 'Recovery' },
  { value: 'lighting',     label: 'Lighting' },
  { value: 'protection',   label: 'Protection' },
]

export default function ProductForm({ initial }: Readonly<{ initial?: Product }>) {
  const isEdit = !!initial?.id
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    if (isEdit && initial?.id) formData.set('id', initial.id)
    startTransition(async () => {
      const action = isEdit ? updateProduct : createProduct
      const result = await action(formData)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Image */}
      <ImageUpload
        folder="products"
        hiddenInputName="imageUrl"
        initialUrl={initial?.image_url ?? null}
        label="Product image"
      />

      {/* Identity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="name" label="Name" required
          defaultValue={initial?.name ?? ''}
          placeholder="Old Man Emu BP-51"
        />
        <Field name="slug" label="Slug (URL-safe)" required
          defaultValue={initial?.slug ?? ''}
          placeholder="arb-bp51-shocks"
          help="Lowercase letters, numbers, dashes only"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="brand" label="Brand"
          defaultValue={initial?.brand ?? ''}
          placeholder="ARB"
        />
        <Select name="category" label="Category" required defaultValue={initial?.category}>
          <option value="">— Pick —</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
      </div>

      {/* Pricing + Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field name="price" label="Price (₱)" type="number" required
          defaultValue={String(initial?.price ?? '')}
          placeholder="48000"
        />
        <Field name="stock" label="Stock" type="number" required
          defaultValue={String(initial?.stock ?? 0)}
          placeholder="10"
          help="0 = out of stock"
        />
      </div>

      {/* Description */}
      <Field name="description" label="Description" multiline
        defaultValue={initial?.description ?? ''}
        placeholder="Premium 51mm bypass shocks. Adjustable compression. Trail-tested for PH terrain."
      />

      {/* Active toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.is_active ?? true}
          className="w-5 h-5"
          style={{ accentColor: 'var(--color-accent)' }}
        />
        <span className="text-sm">
          <strong>Active</strong>
          <span className="ml-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Customers can see and add this product to quotes
          </span>
        </span>
      </label>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
        </button>
        <Link
          href="/admin/products"
          className="px-6 py-3 text-xs font-bold tracking-widest uppercase rounded-sm border"
          style={{ borderColor: 'var(--color-border-2)', color: 'var(--color-text-primary)' }}
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}

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
        <textarea name={name} defaultValue={defaultValue} placeholder={placeholder} rows={3}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required}
          className="w-full px-4 py-3 rounded-sm outline-none text-sm" style={styles} />
      )}
      {help && <span className="block text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{help}</span>}
    </label>
  )
}

function Select({
  name, label, children, required, defaultValue,
}: Readonly<{
  name: string; label: string; children: React.ReactNode; required?: boolean; defaultValue?: string
}>) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <select name={name} defaultValue={defaultValue ?? ''} required={required}
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
