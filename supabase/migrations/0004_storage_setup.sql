-- ============================================================
-- Storage bucket setup — eagles-media
-- Migration 0004
-- ============================================================

-- Create the public bucket for all uploaded images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'eagles-media',
  'eagles-media',
  true,
  10485760,  -- 10 MB per file
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- Storage policies on storage.objects
-- ─────────────────────────────────────────────

-- Anyone can read files in this bucket (public site needs to show images)
create policy "eagles_media_public_read"
  on storage.objects for select
  using (bucket_id = 'eagles-media');

-- Authenticated users can upload (we still verify in app what they're allowed to upload)
create policy "eagles_media_authenticated_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'eagles-media'
    and auth.uid() is not null
  );

-- Admins or original uploader can update file metadata
create policy "eagles_media_admin_or_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'eagles-media'
    and (public.is_admin() or owner = auth.uid())
  );

-- Admins or original uploader can delete
create policy "eagles_media_admin_or_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'eagles-media'
    and (public.is_admin() or owner = auth.uid())
  );
