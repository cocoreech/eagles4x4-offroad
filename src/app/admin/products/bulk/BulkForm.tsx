'use client'

// ============================================================
// BulkForm — multi-row product entry
// ============================================================
// Spreadsheet-style entry of multiple products in one go.
// Each row validated server-side with the same Zod schema as
// single-product add — no shortcuts.

import { useState, useTransition } from 'react'
import { bulkCreateProducts } from './actions'

type Row = {
  name: string
  slug: string
  brand: string
  category: string
  price: string
  stock: string
  description: string
}

const EMPTY_ROW: Row = {
  name: '', slug: '', brand: '',
  category: '', price: '', stock: '0', description: '',
}

const CATEGORIES = [
  { value: 'suspension',   label: 'Suspension' },
  { value: 'wheels-tires', label: 'Wheels & Tires' },
  { value: 'recovery',     label: 'Recovery' },
  { value: 'lighting',     label: 'Lighting' },
  { value: 'protection',   label: 'Protection' },
]

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export default function BulkForm() {
  const [rows, setRows] = useState<Row[]>([
    { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW },
  ])
  const [error, setError] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<{ row: number; message: string }[]>([])
  const [pending, startTransition] = useTransition()

  function updateRow(i: number, key: keyof Row, value: string) {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [key]: value }
      if (key === 'name' && !next[i].slug) {
        next[i].slug = suggestSlug(value)
      }
      return next
    })
  }
  function addRow() {
    setRows(prev => [...prev, { ...EMPTY_ROW }])
  }
  function removeRow(i: number) {
    setRows(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRowErrors([])

    const filled = rows.filter(r =>
      r.name.trim() || r.slug.trim() || r.brand.trim() || r.price.trim()
    )
    if (filled.length === 0) {
      setError('Add at least one row.')
      return
    }

    const fd = new FormData()
    fd.set('rows', JSON.stringify(filled))

    startTransition(async () => {
      const result = await bulkCreateProducts(fd)
      if (result && 'error' in result && result.error) {
        setError(result.error)
        if ('rowErrors' in result && result.rowErrors) setRowErrors(result.rowErrors)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-md p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>#</Th>
                <Th wide>Name *</Th>
                <Th wide>Slug *</Th>
                <Th>Brand</Th>
                <Th>Category *</Th>
                <Th>Price ₱ *</Th>
                <Th>Stock</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const rowErr = rowErrors.find(e => e.row === i + 1)
                return (
                  <tr key={i} style={{ background: rowErr ? 'rgba(239,68,68,0.06)' : undefined }}>
                    <td className="p-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                    <td className="p-1.5">
                      <Input value={row.name} onChange={v => updateRow(i, 'name', v)} placeholder="ARB BP-51 Shocks" />
                    </td>
                    <td className="p-1.5">
                      <Input value={row.slug} onChange={v => updateRow(i, 'slug', v)} placeholder="arb-bp51-shocks" />
                    </td>
                    <td className="p-1.5">
                      <Input value={row.brand} onChange={v => updateRow(i, 'brand', v)} placeholder="ARB" />
                    </td>
                    <td className="p-1.5">
                      <select
                        value={row.category}
                        onChange={e => updateRow(i, 'category', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-sm text-xs outline-none"
                        style={{
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)',
                          colorScheme: 'dark',
                        }}
                      >
                        <option value="">—</option>
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <Input value={row.price} onChange={v => updateRow(i, 'price', v)} placeholder="48000" type="number" />
                    </td>
                    <td className="p-1.5">
                      <Input value={row.stock} onChange={v => updateRow(i, 'stock', v)} placeholder="0" type="number" />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-xs px-2 py-1"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {rowErrors.length > 0 && (
          <div className="mt-4 p-3 rounded-sm" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid var(--color-destructive)' }}>
            <div className="text-xs font-bold mb-2" style={{ color: 'var(--color-destructive)' }}>
              Issues found:
            </div>
            <ul className="text-xs space-y-1" style={{ color: 'var(--color-destructive)' }}>
              {rowErrors.map((e, idx) => (
                <li key={idx}>Row {e.row}: {e.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={addRow}
            className="px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-sm border"
            style={{ borderColor: 'var(--color-border-2)', color: 'var(--color-text-primary)' }}
          >
            + Add Row
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {pending ? 'Saving…' : 'Save All Products'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs" style={{ color: 'var(--color-destructive)' }}>
            {error}
          </p>
        )}

        <p className="mt-4 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          After saving, go back to the products list and click each item to add its image.
          Products start as <strong>Active</strong> with image missing.
        </p>
      </div>
    </form>
  )
}

function Th({ children, wide }: { children?: React.ReactNode; wide?: boolean }) {
  return (
    <th
      className={`text-left p-2 text-[9px] font-bold tracking-widest uppercase ${wide ? 'min-w-[150px]' : ''}`}
      style={{ color: 'var(--color-text-muted)' }}
    >
      {children}
    </th>
  )
}

function Input({
  value, onChange, placeholder, type = 'text',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 rounded-sm text-xs outline-none"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  )
}
