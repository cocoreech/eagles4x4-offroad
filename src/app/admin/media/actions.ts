'use server'

// ============================================================
// Image upload server action — admin-only
// ============================================================
// Uploads a file to the `media` bucket and writes a row to public.media.
// Returns the public URL + media row id so the caller can attach it
// (set as services.image_url, builds.cover_image_url, etc.)

import { z } from 'zod'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { rlUpload, checkLimit } from '@/utils/ratelimit'

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

const MAX_BYTES = 10 * 1024 * 1024  // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

const altSchema = z.string().transform(s => sanitizeText(s, 200)).optional()

/**
 * Upload a single image. Multi-file uploads call this once per file.
 *
 * Returns: { url: string, mediaId: string, error?: undefined }
 *        | { error: string }
 */
export async function uploadImage(formData: FormData) {
  const { user } = await requireAdmin()

  // Per-admin upload rate limit — prevents storage abuse
  const rl = await checkLimit(rlUpload, `upload:${user.id}:${getIp()}`)
  if (!rl.allowed) {
    return { error: 'Too many uploads. Please wait a bit before uploading more.' }
  }

  const file = formData.get('file') as File | null
  const folder = String(formData.get('folder') ?? 'general')  // e.g. 'services', 'builds'
  const altParsed = altSchema.safeParse(formData.get('alt') ?? '')
  const alt = altParsed.success ? altParsed.data ?? '' : ''

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.size > MAX_BYTES) return { error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB).` }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Unsupported file type. Use JPG, PNG, WebP, AVIF or GIF.' }
  }

  // Sanitize folder name (allowlist only known folders)
  const safeFolder = /^[a-z][a-z0-9-]{0,30}$/.test(folder) ? folder : 'general'

  // Generate a unique storage path: media/{folder}/{uuid}-{timestamp}.{ext}
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const filename = `${crypto.randomUUID()}.${ext}`
  const storagePath = `${safeFolder}/${filename}`

  // Upload to bucket — use service role since users can't write storage directly
  // via the Supabase JS client without specific bucket policies.
  const admin = createServiceRoleClient()
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadErr } = await admin.storage
    .from('media')
    .upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadErr) {
    console.error('[uploadImage] storage upload', uploadErr)
    return { error: 'Upload failed. Please try again.' }
  }

  // Get the public URL for the uploaded file
  const { data: publicUrlData } = admin.storage.from('media').getPublicUrl(storagePath)
  const publicUrl = publicUrlData.publicUrl

  // Insert a row in public.media so admin can manage uploaded images later
  const supabase = createClient()
  const { data: mediaRow, error: insertErr } = await supabase
    .from('media')
    .insert({
      storage_path: storagePath,
      public_url:   publicUrl,
      file_name:    sanitizeText(file.name, 200),
      mime_type:    file.type,
      size_bytes:   file.size,
      alt_text:     alt || null,
      uploaded_by:  user.id,
      tags:         [safeFolder],
    })
    .select('id')
    .single()

  if (insertErr || !mediaRow) {
    console.error('[uploadImage] media insert', insertErr)
    // File is in storage but DB row failed — return URL anyway so caller can use it
    return { url: publicUrl, mediaId: '', warning: 'Image uploaded but library entry failed.' }
  }

  return { url: publicUrl, mediaId: mediaRow.id }
}

/**
 * Delete an image by media row id (also removes from storage).
 * Admin-only — or the original uploader.
 */
export async function deleteImage(formData: FormData) {
  await requireAdmin()
  const mediaId = String(formData.get('mediaId') ?? '')
  if (!z.string().uuid().safeParse(mediaId).success) {
    return { error: 'Invalid id.' }
  }

  const supabase = createClient()
  const { data: row } = await supabase
    .from('media')
    .select('storage_path')
    .eq('id', mediaId)
    .maybeSingle()

  if (!row) return { error: 'Not found.' }

  const admin = createServiceRoleClient()
  await admin.storage.from('media').remove([row.storage_path])
  await supabase.from('media').delete().eq('id', mediaId)

  return { success: true }
}
