'use client'

// ============================================================
// MultiImageGallery — drag-drop multiple images, with reorder + remove
// ============================================================
// Used by Builds form for the gallery_image_urls array.
// Submits the array as a JSON string in a hidden input.

import { useState, useRef } from 'react'
import { uploadImage } from '@/app/admin/media/actions'

type Props = {
  folder: string                  // 'builds', 'about', etc.
  hiddenInputName?: string        // form field name
  initialUrls?: string[]
  maxImages?: number
  label?: string
}

const HARD_MAX_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function MultiImageGallery({
  folder,
  hiddenInputName = 'galleryUrls',
  initialUrls = [],
  maxImages = 30,
  label = 'Photo gallery',
}: Props) {
  const [urls, setUrls] = useState<string[]>(initialUrls)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setError(null)
    if (urls.length + files.length > maxImages) {
      setError(`Max ${maxImages} photos per build.`)
      return
    }

    setBusy(true)
    const added: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.size > HARD_MAX_BYTES) {
        setError(`"${file.name}" is too large (${formatBytes(file.size)}). Max 10 MB.`)
        continue
      }
      if (!file.type.startsWith('image/')) continue

      try {
        const fd = new FormData()
        fd.set('file', file)
        fd.set('folder', folder)
        const result = await uploadImage(fd)
        if ('url' in result && result.url) added.push(result.url)
        else if ('error' in result && result.error) {
          setError(result.error)
          break
        }
      } catch (e) {
        console.error(e)
        setError('One or more uploads failed.')
        break
      }
    }
    if (added.length) setUrls(prev => [...prev, ...added])
    setBusy(false)
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  function removeAt(index: number) {
    setUrls(prev => prev.filter((_, i) => i !== index))
  }

  function moveUp(index: number) {
    if (index === 0) return
    setUrls(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(index - 1, 0, item)
      return next
    })
  }
  function moveDown(index: number) {
    setUrls(prev => {
      if (index === prev.length - 1) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(index + 1, 0, item)
      return next
    })
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
        <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          <strong style={{ color: 'var(--color-accent)' }}>{urls.length}</strong> of {maxImages} · Recommended: 1600×1200 · under 600 KB each
        </span>
      </div>

      {/* Hidden input that submits the URL array as JSON */}
      <input type="hidden" name={hiddenInputName} value={JSON.stringify(urls)} />

      {/* Gallery grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {urls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative group rounded-sm overflow-hidden"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
            >
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Build photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              <div className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(10,10,10,0.85)', color: 'var(--color-text-primary)' }}>
                #{i + 1}
              </div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition" style={{ background: 'rgba(10,10,10,0.8)' }}>
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
                    className="px-2 py-1 text-xs font-bold rounded-sm disabled:opacity-30"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button type="button" onClick={() => moveDown(i)} disabled={i === urls.length - 1}
                    className="px-2 py-1 text-xs font-bold rounded-sm disabled:opacity-30"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
                <button type="button" onClick={() => removeAt(i)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm"
                  style={{ background: 'var(--color-destructive)', color: '#fff' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {urls.length < maxImages && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => !busy && fileInput.current?.click()}
          className="rounded-md transition cursor-pointer"
          style={{
            background: 'var(--color-bg)',
            border: '2px dashed var(--color-border)',
            padding: '24px 16px',
            textAlign: 'center',
            minHeight: '100px',
          }}
        >
          {busy ? (
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Uploading…</div>
          ) : (
            <div style={{ color: 'var(--color-text-muted)' }}>
              <div
                className="mx-auto mb-2 flex items-center justify-center rounded-full text-2xl font-thin"
                style={{
                  width: 44, height: 44,
                  background: 'rgba(201,168,76,0.08)',
                  color: 'var(--color-accent)',
                  border: '1.5px solid rgba(201,168,76,0.25)',
                }}
              >
                +
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Click or drag photos (multiple OK)
              </div>
              <div className="text-[10px] mt-1">
                JPG, PNG, WebP — max 10 MB each
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={onChange}
      />

      {error && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
