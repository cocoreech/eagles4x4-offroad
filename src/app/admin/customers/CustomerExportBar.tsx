'use client'

import { toCustomersCsv, type CustomerCsvRow } from '@/lib/admin/customersCsv'

export default function CustomerExportBar({ rows }: Readonly<{ rows: CustomerCsvRow[] }>) {
  function downloadCsv() {
    const csv = toCustomersCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const btn = 'rounded-sm px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em]'

  return (
    <div className="flex gap-3 print:hidden">
      <button type="button" onClick={downloadCsv} className={btn} style={{ background: 'var(--color-accent)', color: '#000' }}>
        Export CSV (Excel)
      </button>
      <button type="button" onClick={() => window.print()} className={btn} style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
        Save as PDF
      </button>
    </div>
  )
}
