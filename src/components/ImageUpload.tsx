'use client'

// ============================================================
// ImageUpload — drag-drop OR click-to-pick image upload
// ============================================================
// Used inside admin editors. Wraps the uploadImage server action.
// Shows preview + delete control once uploaded.
// Warns the admin BEFORE upload if file is heavier than recommended
// (helps mobile customers save data).

import { useState, useRef } from 'react'
import { uploadImage } from '@/app/admin/media/actions'

type Props = {
  folder: string                // 'services' | 'products' | 'builds' | 'about'
  hiddenInputName?: string      // name of hidden input that submits the URL
  initialUrl?: string | null    // existing image (edit mode)
  label?: string                // visible label
  recommendedSize?: string      // e.g. "1200×1200" — display only
  recommendedKB?: number        // warns when uploaded file exceeds this
}

const HARD_MAX_BYTES = 10 * 1024 * 1024  // matches server limit

function formatBytes(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function ImageUpload({
  folder,
  hiddenInputName = 'imageUrl',
  initialUrl = null,
  label = 'Image',
  recommendedSize = '1200×1200',
  recommendedKB = 500,
}: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)
    setWarning(null)
    setFileMeta({ name: file.name, size: file.size })

    // Client-side soft warning (size, type) — server still re-validates
    if (file.size > HARD_MAX_BYTES) {
      setError(`File too large: ${formatBytes(file.size)} (max 10 MB).`)
      setFileMeta(null)
      return
    }
    if (file.size > recommendedKB * 1024) {
      setWarning(
        `This image is ${formatBytes(file.size)} — heavier than the recommended ${recommendedKB} KB. ` +
        `It will upload, but slow mobile users will use more data to view it. ` +
        `Consider compressing first at squoosh.app or tinypng.com.`
      )
    }

    setBusy(true)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('folder', folder)
    try {
      const result = await uploadImage(fd)
      if ('error' in result && result.error) {
        setError(result.error)
      } else if ('url' in result && result.url) {
        setUrl(result.url)
        if ('warning' in result && result.warning) setError(result.warning)
      }
    } catch (e) {
      console.error(e)
      setError('Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function removeImage() {
    setUrl(null)
    setFileMeta(null)
    setWarning(null)
    setError(null)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          Recommended: <strong style={{ color: 'var(--color-accent)' }}>{recommendedSize}</strong>
          {' · under '}
          <strong style={{ color: 'var(--color-accent)' }}>{recommendedKB} KB</strong>
        </span>
      </div>

      {/* Hidden input that submits the URL with the parent form */}
      <input type="hidden" name={hiddenInputName} value={url ?? ''} />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className="rounded-md transition cursor-pointer"
        style={{
          background: 'var(--color-bg)',
          border: '2px dashed ' + (url ? 'var(--color-accent)' : 'var(--color-border)'),
          padding: url ? 0 : '40px 16px',
          textAlign: 'center',
          minHeight: '140px',
          display: url ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {url ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={label}
              className="w-full rounded-md max-h-80 object-cover"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeImage() }}
              className="absolute top-2 right-2 text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-sm"
              style={{ background: 'rgba(10,10,10,0.85)', color: 'var(--color-destructive)' }}
            >
              ✕ Remove
            </button>
          </div>
        ) : busy ? (
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <div className="text-2xl mb-2">⏳</div>
            <div>Uploading {fileMeta && `(${formatBytes(fileMeta.size)})`}…</div>
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)' }}>
            <div
              className="mx-auto mb-3 flex items-center justify-center rounded-full text-3xl font-thin"
              style={{
                width: 56, height: 56,
                background: 'rgba(201,168,76,0.08)',
                color: 'var(--color-accent)',
                border: '1.5px solid rgba(201,168,76,0.25)',
              }}
            >
              +
            </div>
            <div className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
              Click or drag an image here
            </div>
            <div className="text-[10px]">
              JPG, PNG, WebP, AVIF, GIF · max 10 MB
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={onChange}
      />

      {/* File info + warnings */}
      {fileMeta && !error && (
        <p className="mt-2 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          {fileMeta.name} · {formatBytes(fileMeta.size)}
        </p>
      )}
      {warning && (
        <p className="mt-2 text-[11px]" style={{ color: '#f59e0b' }}>
          ⚠ {warning}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
