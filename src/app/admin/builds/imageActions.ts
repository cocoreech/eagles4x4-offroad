'use server'

// ============================================================
// Inline cover image set/clear for builds list
// ============================================================

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'

const imageUpdateSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url().nullable().optional()
    .refine(v =>
      v == null || v === '' ||
      v.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`),
      'Image URL must be from Eagles 4x4 storage.'
    ),
})

export async function setBuildCoverImage(formData: FormData) {
  await requireAdmin()
  const parsed = imageUpdateSchema.safeParse({
    id:       formData.get('id'),
    imageUrl: formData.get('imageUrl') || null,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('builds')
    .update({ cover_image_url: parsed.data.imageUrl || null })
    .eq('id', parsed.data.id)

  if (error) return { error: 'Could not save cover.' }
  revalidatePath('/admin/builds')
  revalidatePath('/')
  return { success: true }
}
