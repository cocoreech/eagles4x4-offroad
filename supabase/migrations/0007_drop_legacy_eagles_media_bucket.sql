-- ============================================================
-- 0007 — Drop legacy eagles-media bucket policies
-- ============================================================
-- Replaced by separate `builds` and `media` buckets in migration 0006.
-- Supabase blocks direct DELETE from storage.buckets / storage.objects via
-- the storage.protect_delete() trigger. So we drop only the policies here.
-- The bucket itself must be deleted via the dashboard:
--   supabase.com/dashboard → eagles4x4-offroad → Storage → eagles-media → Delete

drop policy if exists "eagles_media_public_read"              on storage.objects;
drop policy if exists "eagles_media_authenticated_upload"     on storage.objects;
drop policy if exists "eagles_media_admin_or_owner_update"    on storage.objects;
drop policy if exists "eagles_media_admin_or_owner_delete"    on storage.objects;
