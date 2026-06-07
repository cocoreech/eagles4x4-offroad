'use client'

// ============================================================
// InlineImageCell — small click-to-upload cell for table rows
// ============================================================
// Used in admin list pages so admin can drop an image without
// opening the full edit form.
//
// Flow: click → file picker → uploadImage server action →
//       setImage server action (writes URL to the row) → UI updates

import { useRef, useState, useTransition } from 'react'
import { uploadImage } from '@/app/admin/media/actions'

type Props = {
  rowId: string
  initialUrl: string | null
  folder: string                        // upload bucket folder ('products', 'services'…)
  setImageAction: (fd: FormData) => Promise<{ success?: boolean; error?: string }>
}

export default function InlineImageCell({
  rowId,
  initialUrl,
  folder,
  setImageAction,
}: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError(null)

    if (file.size > 10 * 1024 * 1024) {
      setError('Max 10 MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Image only')
      return
    }

    setBusy(true)
    try {
      // 1. Upload the file
      const fd = new FormData()
      fd.set('file', file)
      fd.set('folder', folder)
      const upload = await uploadImage(fd)
      if ('error' in upload && upload.error) {
        setError(upload.error)
        setBusy(false)
        return
      }
      if (!('url' in upload) || !upload.url) {
        setError('Upload failed')
        setBusy(false)
        return
      }

      // 2. Save the URL to the row
      const saveFd = new FormData()
      saveFd.set('id', rowId)
      saveFd.set('imageUrl', upload.url)
      startTransition(async () => {
        const result = await setImageAction(saveFd)
        if (result?.error) {
          setError(result.error)
        } else {
          setUrl(upload.url!)
        }
        setBusy(false)
      })
    } catch (e) {
      console.error(e)
      setError('Upload failed')
      setBusy(false)
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so the same file can be re-picked if needed
    e.target.value = ''
  }

  async function removeImage(e: React.MouseEvent) {
    e.stopPropagation()
    setError(null)
    setBusy(true)
    const saveFd = new FormData()
    saveFd.set('id', rowId)
    saveFd.set('imageUrl', '')
    startTransition(async () => {
      const result = await setImageAction(saveFd)
      if (result?.error) setError(result.error)
      else                setUrl(null)
      setBusy(false)
    })
  }

  return (
    <div className="relative inline-block group">
      <button
        type="button"
        onClick={() => !busy && fileInput.current?.click()}
        disabled={busy}
        title={url ? 'Click to replace image' : 'Click to upload image'}
        className="w-12 h-12 rounded-sm flex items-center justify-center transition cursor-pointer overflow-hidden"
        style={{
          background: 'var(--color-bg)',
          border: '1px dashed ' + (url ? 'var(--color-accent)' : 'var(--color-border)'),
        }}
      >
        {busy ? (
          <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>…</div>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-2xl font-thin" style={{ color: 'var(--color-accent)' }}>+</div>
        )}
      </button>

      {/* Remove button — visible on hover when image exists */}
      {url && !busy && (
        <button
          type="button"
          onClick={removeImage}
          title="Remove image"
          aria-label="Remove image"
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
          style={{ background: 'var(--color-destructive)', color: '#fff' }}
        >
          ×
        </button>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={onChange}
      />

      {error && (
        <div className="absolute top-full left-0 mt-1 text-[10px] whitespace-nowrap" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
